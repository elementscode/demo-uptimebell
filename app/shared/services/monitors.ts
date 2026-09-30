import { sql, session, NotFoundError, ValidationError } from "@elements/app";
import { accountEvents } from "#app/shared/services/events";

export type MonitorStatus = "pending" | "up" | "down";

/** Ten minutes of checks, averaged. 144 of them make up the 24-hour chart. */
export interface ChartPoint {
  t: number;
  ms: number | null;
  checks: number;
  failures: number;
}

export interface MonitorSummary {
  id: string;
  name: string;
  url: string;
  status: MonitorStatus;
  lastCheckedAt: Date | null;
  lastResponseMs: number | null;
  lastStatusCode: number | null;
  lastError: string | null;
  uptime24: number | null;
  uptime7: number | null;
  uptime90: number | null;
  series: ChartPoint[];
}

export interface MonitorForm {
  name: string;
  url: string;
}

export const BUCKET_MS = 10 * 60 * 1000;

interface MonitorRow {
  id: string;
  name: string;
  url: string;
  status: MonitorStatus;
  lastCheckedAt: Date | null;
  lastResponseMs: number | null;
  lastStatusCode: number | null;
  lastError: string | null;
}

function uptimeSince(monitorId: string, days: number): number | null {
  let row = sql<{ uptime: number | null }>(`
    select (sum(checks - failures)::float8 / nullif(sum(checks), 0)) as uptime
      from monitorDays
     where monitorId = ${monitorId}
       and day > (now() at time zone 'utc')::date - ${days}::int
  `).first();

  return row?.uptime ?? null;
}

export function loadSeries(monitorId: string): ChartPoint[] {
  return sql<ChartPoint>(`
    select (floor(extract(epoch from checkedAt) * 1000 / ${BUCKET_MS}) * ${BUCKET_MS})::float8 as t,
           round(avg(responseMs))::int as ms,
           count(*)::int as checks,
           (count(*) filter (where not ok))::int as failures
      from checks
     where monitorId = ${monitorId}
       and checkedAt > now() - interval '24 hours'
     group by 1
     order by 1
  `).all();
}

function summarize(row: MonitorRow): MonitorSummary {
  let day = sql<{ uptime: number | null }>(`
    select avg(ok::int)::float8 as uptime
      from checks
     where monitorId = ${row.id}
       and checkedAt > now() - interval '24 hours'
  `).first();

  return {
    ...row,
    uptime24: day?.uptime ?? null,
    uptime7: uptimeSince(row.id, 7),
    uptime90: uptimeSince(row.id, 90),
    series: loadSeries(row.id),
  };
}

const MONITOR_COLUMNS = sql.raw(`id, name, url, status, lastCheckedAt, lastResponseMs, lastStatusCode, lastError`);

export function loadMonitors(accountId: string): MonitorSummary[] {
  let rows = sql<MonitorRow>(`
    select ${MONITOR_COLUMNS}
      from monitors
     where accountId = ${accountId}
     order by createdAt
  `).all();

  return rows.map(summarize);
}

function loadMonitor(accountId: string, monitorId: string): MonitorSummary {
  let row = sql<MonitorRow>(`
    select ${MONITOR_COLUMNS}
      from monitors
     where accountId = ${accountId}
       and id = ${monitorId}
  `).first();

  if (!row) {
    throw new NotFoundError("monitor not found");
  }

  return summarize(row);
}

/** @rpc */
export function fetchMonitor(monitorId: string): MonitorSummary {
  return loadMonitor(session.getOrThrow("userId"), monitorId);
}

/** @rpc */
export function fetchMonitors(): MonitorSummary[] {
  return loadMonitors(session.getOrThrow("userId"));
}

export function validateMonitor(form: MonitorForm): MonitorForm {
  let name = form.name.trim();
  let url = form.url.trim();
  let errors: { name?: string[]; url?: string[] } = {};

  if (!name) {
    errors.name = ["give the monitor a name"];
  }

  let parsed: URL | null = null;

  try {
    parsed = new URL(url);
  } catch {
    parsed = null;
  }

  if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    errors.url = ["enter a full http or https url"];
  }

  if (errors.name || errors.url) {
    throw new ValidationError(errors);
  }

  return { name, url };
}

/** @rpc */
export function addMonitor(form: MonitorForm): MonitorSummary {
  let accountId = session.getOrThrow("userId");
  let clean = validateMonitor(form);

  let row = sql<MonitorRow>(`
    insert into monitors (accountId, name, url)
         values (${accountId}, ${clean.name}, ${clean.url})
      returning ${MONITOR_COLUMNS}
  `).firstOrThrow();

  accountEvents.notify({ accountId, kind: "monitors" });

  return summarize(row);
}

/** @rpc */
export function deleteMonitor(monitorId: string) {
  let accountId = session.getOrThrow("userId");

  sql(`delete from monitors where id = ${monitorId} and accountId = ${accountId}`);

  accountEvents.notify({ accountId, kind: "monitors" });
}
