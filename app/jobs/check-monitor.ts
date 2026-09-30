import { Job, sql, tx } from "@elements/app";
import { accountEvents } from "#app/shared/services/events";
import { SendIncidentAlertJob } from "#app/jobs/send-incident-alert";

export interface CheckMonitorJobFields {
  monitorId: string;
}

export interface CheckResult {
  ok: boolean;
  statusCode: number | null;
  responseMs: number | null;
  error: string | null;
}

export const TIMEOUT_MS = 10_000;

/** Three failures in a row opens an incident. */
export const FAILURE_THRESHOLD = 3;

export async function probe(url: string): Promise<CheckResult> {
  let started = performance.now();

  try {
    let res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "uptimebell/1.0 (+https://uptimebell.test)" },
    });

    let responseMs = Math.round(performance.now() - started);
    await res.body?.cancel();

    return {
      ok: res.status < 400,
      statusCode: res.status,
      responseMs,
      error: res.status < 400 ? null : `HTTP ${res.status}`,
    };
  } catch (err: any) {
    let cause = err?.cause?.code ?? err?.cause?.message;
    let timedOut = err?.name === "TimeoutError";

    return {
      ok: false,
      statusCode: null,
      responseMs: null,
      error: timedOut ? `timed out after ${TIMEOUT_MS / 1000}s` : (cause ? String(cause) : String(err?.message ?? err)),
    };
  }
}

/**
 * Writes one check: the raw row, the daily rollup, the monitor's current
 * state, and the incident when this failure is the third in a row. Returns the
 * incident id when one opened.
 */
export function recordCheck(monitorId: string, result: CheckResult): { accountId: string; incidentId: string | null } | null {
  return tx(() => {
    let monitor = sql<{ accountId: string; name: string; consecutiveFailures: number }>(`
      update monitors
         set status = ${result.ok ? "up" : "down"},
             consecutiveFailures = case when ${result.ok} then 0 else consecutiveFailures + 1 end,
             lastCheckedAt = now(),
             lastResponseMs = ${result.responseMs},
             lastStatusCode = ${result.statusCode},
             lastError = ${result.error}
       where id = ${monitorId}
   returning accountId, name, consecutiveFailures
    `).first();

    // The monitor was deleted between the schedule and the run.
    if (!monitor) {
      return null;
    }

    sql(`
      insert into checks (monitorId, ok, statusCode, responseMs, error)
           values (${monitorId}, ${result.ok}, ${result.statusCode}, ${result.responseMs}, ${result.error})
    `);

    sql(`
      insert into monitorDays (monitorId, day, checks, failures)
           values (${monitorId}, (now() at time zone 'utc')::date, 1, ${result.ok ? 0 : 1})
      on conflict (monitorId, day)
      do update set checks = monitorDays.checks + 1,
                    failures = monitorDays.failures + excluded.failures
    `);

    let incidentId: string | null = null;

    if (!result.ok && monitor.consecutiveFailures >= FAILURE_THRESHOLD) {
      let incident = sql<{ id: string }>(`
        insert into incidents (accountId, monitorId, title, status)
             values (${monitor.accountId}, ${monitorId}, ${`${monitor.name} is down`}, 'investigating')
        on conflict (monitorId) where status <> 'resolved' do nothing
          returning id
      `).first();

      if (incident) {
        incidentId = incident.id;

        sql(`
          insert into incidentUpdates (incidentId, status, body)
               values (${incident.id}, 'investigating', ${`Automated: ${FAILURE_THRESHOLD} checks in a row failed (${result.error ?? "no response"}). We are looking into it.`})
        `);

        new SendIncidentAlertJob({ incidentId: incident.id }).schedule();
      }
    }

    return { accountId: monitor.accountId, incidentId };
  });
}

/**
 * Requests one monitor's url and records the result. One attempt only: a
 * retry would record a second check for the same minute.
 */
export class CheckMonitorJob extends Job<CheckMonitorJobFields> {
  static maxAttempts = 1;
  static timeoutMs = TIMEOUT_MS + 10_000;

  async run() {
    let monitor = sql<{ url: string }>(`select url from monitors where id = ${this.fields.monitorId}`).first();

    if (!monitor) {
      return;
    }

    let result = await probe(monitor.url);
    let recorded = recordCheck(this.fields.monitorId, result);

    if (!recorded) {
      return;
    }

    accountEvents.notify({ accountId: recorded.accountId, kind: "check", monitorId: this.fields.monitorId });

    if (recorded.incidentId) {
      accountEvents.notify({ accountId: recorded.accountId, kind: "incidents" });
    }
  }
}
