import { test, assert, equal, sql, session, ValidationError, NotFoundError } from "@elements/app";
import { postUpdate, declareIncident, fetchIncidents } from "#app/shared/services/incidents";

function setup() {
  // Slugs and emails are unique, and test files run at once against one
  // database, so each account gets its own.
  let slug = `test-co-${crypto.randomUUID().slice(0, 8)}`;
  let account = sql<{ id: string }>(`
    insert into accounts (name, slug, email, passwordHash)
         values ('Test Co', ${slug}, ${`${slug}@test.test`}, 'x')
      returning id
  `).firstOrThrow();

  let monitor = sql<{ id: string }>(`
    insert into monitors (accountId, name, url) values (${account.id}, 'API', 'https://api.test') returning id
  `).firstOrThrow();

  sql(`
    insert into subscribers (accountId, email)
         values (${account.id}, 'a@customer.test'), (${account.id}, 'b@customer.test')
  `);

  session.login({ userId: account.id, userName: "Test Co", slug });

  return { accountId: account.id, monitorId: monitor.id, slug };
}

function updateJobs(incidentId: string): number {
  return sql<{ n: number }>(`
    select count(*)::int as n from elements.jobs
     where path like '%SendIncidentUpdateJob'
       and fields->>'updateId' in (select id::text from incidentUpdates where incidentId = ${incidentId})
  `).firstOrThrow().n;
}

test("incidents", () => {
  test("declaring an incident posts its first update and emails each subscriber", () => {
    let { monitorId } = setup();
    let incident = declareIncident({ title: "Slow API", monitorId, status: "investigating", body: "Looking into it." });

    equal(incident.status, "investigating");
    equal(incident.monitorName, "API");
    equal(incident.updates.length, 1);
    equal(updateJobs(incident.id), 2);
  });

  test("resolving sets resolvedAt and a later update reopens it", () => {
    let { monitorId } = setup();
    let incident = declareIncident({ title: "Slow API", monitorId, status: "investigating", body: "Looking." });

    let resolved = postUpdate({ incidentId: incident.id, status: "resolved", body: "Fixed." });
    equal(resolved.status, "resolved");
    assert(resolved.resolvedAt instanceof Date, "resolvedAt is set");
    equal(resolved.updates[0].status, "resolved", "newest update first");

    let reopened = postUpdate({ incidentId: incident.id, status: "identified", body: "It came back." });
    equal(reopened.resolvedAt, null);
    equal(reopened.updates.length, 3);
  });

  test("an empty update is rejected", () => {
    let { monitorId } = setup();
    let incident = declareIncident({ title: "Slow API", monitorId, status: "investigating", body: "Looking." });
    let threw = false;

    try {
      postUpdate({ incidentId: incident.id, status: "identified", body: "  " });
    } catch (err) {
      threw = true;
      assert(err instanceof ValidationError, `got ${err}`);
    }

    assert(threw);
  });

  test("a monitor cannot have two open incidents", () => {
    let { monitorId } = setup();
    declareIncident({ title: "One", monitorId, status: "investigating", body: "a" });
    let threw = false;

    try {
      declareIncident({ title: "Two", monitorId, status: "investigating", body: "b" });
    } catch (err) {
      threw = true;
      assert(err instanceof ValidationError, `got ${err}`);
    }

    assert(threw);
  });

  test("another account's incident is not found", () => {
    let { monitorId, slug } = setup();
    let incident = declareIncident({ title: "Mine", monitorId, status: "investigating", body: "a" });

    let other = sql<{ id: string }>(`
      insert into accounts (name, slug, email, passwordHash) values ('Other', ${`other-${slug}`}, ${`other-${slug}@test.test`}, 'x') returning id
    `).firstOrThrow();
    session.login({ userId: other.id, userName: "Other", slug: `other-${slug}` });

    equal(fetchIncidents().length, 0);

    let threw = false;

    try {
      postUpdate({ incidentId: incident.id, status: "resolved", body: "not mine" });
    } catch (err) {
      threw = true;
      assert(err instanceof NotFoundError, `got ${err}`);
    }

    assert(threw);
  });
});
