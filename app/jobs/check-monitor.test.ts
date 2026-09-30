import { test, assert, equal, sql } from "@elements/app";
import { recordCheck, CheckResult, FAILURE_THRESHOLD } from "#app/jobs/check-monitor";

const FAIL: CheckResult = { ok: false, statusCode: 503, responseMs: 120, error: "HTTP 503" };
const PASS: CheckResult = { ok: true, statusCode: 200, responseMs: 80, error: null };

function makeMonitor(): string {
  let account = sql<{ id: string }>(`
    insert into accounts (name, slug, email, passwordHash)
         values ('Test Co', 'test-co', 'ops@test.test', 'x')
      returning id
  `).firstOrThrow();

  return sql<{ id: string }>(`
    insert into monitors (accountId, name, url)
         values (${account.id}, 'API', 'https://api.test')
      returning id
  `).firstOrThrow().id;
}

function monitor(id: string) {
  return sql<{ status: string; consecutiveFailures: number; lastResponseMs: number | null }>(`
    select status, consecutiveFailures, lastResponseMs from monitors where id = ${id}
  `).firstOrThrow();
}

function openIncidents(id: string): number {
  return sql<{ n: number }>(`select count(*)::int as n from incidents where monitorId = ${id} and status <> 'resolved'`).firstOrThrow().n;
}

function alertJobs(): number {
  return sql<{ n: number }>(`
    select count(*)::int as n from elements.jobs where path like '%SendIncidentAlertJob'
  `).firstOrThrow().n;
}

test("check monitor", () => {
  test("a passing check records the row, the rollup and the state", () => {
    let id = makeMonitor();

    recordCheck(id, PASS);

    equal(monitor(id).status, "up");
    equal(monitor(id).lastResponseMs, 80);

    let day = sql<{ checks: number; failures: number }>(`select checks, failures from monitorDays where monitorId = ${id}`).firstOrThrow();
    equal(day.checks, 1);
    equal(day.failures, 0);
  });

  test("the third failure in a row opens one incident and alerts the account", () => {
    let id = makeMonitor();
    let before = alertJobs();

    for (let i = 1; i < FAILURE_THRESHOLD; i++) {
      let result = recordCheck(id, FAIL);
      equal(result?.incidentId, null, `failure ${i} should not open an incident`);
    }

    equal(openIncidents(id), 0);

    let third = recordCheck(id, FAIL);
    assert(third?.incidentId, "the third failure opens an incident");
    equal(openIncidents(id), 1);
    equal(alertJobs(), before + 1);

    let update = sql<{ status: string }>(`select status from incidentUpdates where incidentId = ${third!.incidentId}`).firstOrThrow();
    equal(update.status, "investigating");

    recordCheck(id, FAIL);
    recordCheck(id, FAIL);
    equal(openIncidents(id), 1, "further failures join the open incident");
    equal(alertJobs(), before + 1);
  });

  test("a pass resets the failure count", () => {
    let id = makeMonitor();

    recordCheck(id, FAIL);
    recordCheck(id, FAIL);
    recordCheck(id, PASS);
    recordCheck(id, FAIL);

    equal(monitor(id).consecutiveFailures, 1);
    equal(openIncidents(id), 0);

    let day = sql<{ checks: number; failures: number }>(`select checks, failures from monitorDays where monitorId = ${id}`).firstOrThrow();
    equal(day.checks, 4);
    equal(day.failures, 3);
  });

  test("a deleted monitor records nothing", () => {
    let id = makeMonitor();
    sql(`delete from monitors where id = ${id}`);

    equal(recordCheck(id, PASS), null);
    equal(sql<{ n: number }>(`select count(*)::int as n from checks where monitorId = ${id}`).firstOrThrow().n, 0);
  });
});
