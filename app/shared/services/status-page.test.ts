import { test, assert, equal, sql, NotFoundError } from "@elements/app";
import { BAR_DAYS, fetchComponents, subscribe, unsubscribe } from "#app/shared/services/status-page";

function account(): string {
  let row = sql<{ id: string }>(`
    insert into accounts (name, slug, email, passwordHash)
         values ('Test Co', 'test-co', 'ops@test.test', 'x')
      returning id
  `).firstOrThrow();

  return row.id;
}

test("status page", () => {
  test("each component has one bar per day for 90 days", () => {
    let accountId = account();
    let monitor = sql<{ id: string }>(`insert into monitors (accountId, name, url) values (${accountId}, 'API', 'https://api.test') returning id`).firstOrThrow();

    sql(`insert into monitorDays (monitorId, day, checks, failures) values (${monitor.id}, (now() at time zone 'utc')::date - 3, 288, 2)`);

    let [component] = fetchComponents("test-co");
    equal(component.days.length, BAR_DAYS);
    equal(component.days[BAR_DAYS - 4].failures, 2);
    equal(component.days[BAR_DAYS - 1].checks, 0);
    assert(component.uptime90 !== null && component.uptime90 < 1);
    assert(!("url" in component), "the public page does not expose urls");
  });

  test("subscribing twice keeps one row, and unsubscribe removes it", () => {
    let accountId = account();

    subscribe("test-co", "Reader@Example.com");
    subscribe("test-co", "reader@example.com");

    let rows = sql<{ email: string; token: string }>(`select email, token from subscribers where accountId = ${accountId}`).all();
    equal(rows.length, 1);
    equal(rows[0].email, "reader@example.com");

    unsubscribe(rows[0].token);
    equal(sql(`select 1 from subscribers where accountId = ${accountId}`).all().length, 0);
  });

  test("an unknown slug is not found", () => {
    let threw = false;

    try {
      fetchComponents("nobody");
    } catch (err) {
      threw = true;
      assert(err instanceof NotFoundError, `got ${err}`);
    }

    assert(threw);
  });
});
