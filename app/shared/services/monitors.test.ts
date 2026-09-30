import { test, assert, equal, sql, session, ValidationError } from "@elements/app";
import { addMonitor, deleteMonitor, fetchMonitors } from "#app/shared/services/monitors";

function login(): string {
  let account = sql<{ id: string }>(`
    insert into accounts (name, slug, email, passwordHash)
         values ('Test Co', 'test-co', 'ops@test.test', 'x')
      returning id
  `).firstOrThrow();

  session.login({ userId: account.id, userName: "Test Co", slug: "test-co" });

  return account.id;
}

test("monitors", () => {
  test("add, summarize and delete", () => {
    let accountId = login();

    let monitor = addMonitor({ name: " Website ", url: "https://example.com" });
    equal(monitor.name, "Website");
    equal(monitor.status, "pending");
    equal(monitor.uptime24, null);

    sql(`
      insert into checks (monitorId, checkedAt, ok, statusCode, responseMs)
           values (${monitor.id}, now() - interval '5 minutes', true, 200, 100),
                  (${monitor.id}, now() - interval '4 minutes', false, 500, 300)
    `);
    sql(`insert into monitorDays (monitorId, day, checks, failures) values (${monitor.id}, (now() at time zone 'utc')::date, 2, 1)`);

    let [summary] = fetchMonitors();
    equal(summary.uptime24, 0.5);
    equal(summary.uptime90, 0.5);
    equal(summary.series.reduce((n, p) => n + p.checks, 0), 2);

    deleteMonitor(monitor.id);
    equal(fetchMonitors().length, 0);
    equal(sql<{ n: number }>(`select count(*)::int as n from monitors where accountId = ${accountId}`).firstOrThrow().n, 0);
  });

  test("rejects a url that is not http", () => {
    login();
    let threw = false;

    try {
      addMonitor({ name: "FTP", url: "ftp://example.com" });
    } catch (err) {
      threw = true;
      assert(err instanceof ValidationError, `got ${err}`);
    }

    assert(threw);
  });
});
