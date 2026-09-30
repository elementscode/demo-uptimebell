import { test, assert, sql, session, Request, Response, NotFoundError } from "@elements/app";
import route from "./index";

function account(slug: string): string {
  return sql<{ id: string }>(`
    insert into accounts (name, slug, email, passwordHash) values (${slug}, ${slug}, ${`${slug}@test.test`}, 'x') returning id
  `).firstOrThrow().id;
}

test("incident route", () => {
  test("shows the incident and its updates to its account", () => {
    let accountId = account("owner");
    let incident = sql<{ id: string }>(`
      insert into incidents (accountId, title, status) values (${accountId}, 'Queue backlog', 'identified') returning id
    `).firstOrThrow();

    sql(`insert into incidentUpdates (incidentId, status, body) values (${incident.id}, 'identified', 'A worker pool is stuck.')`);
    session.login({ userId: accountId, userName: "owner", slug: "owner" });

    let html = route({ params: { id: incident.id } } as unknown as Request, {} as Response)!.toHtml();

    assert(html.includes("Queue backlog"));
    assert(html.includes("A worker pool is stuck."));
  });

  test("another account's incident is a 404", () => {
    let incident = sql<{ id: string }>(`
      insert into incidents (accountId, title, status) values (${account("owner")}, 'Private', 'investigating') returning id
    `).firstOrThrow();

    let other = account("other");
    session.login({ userId: other, userName: "other", slug: "other" });

    let threw = false;

    try {
      route({ params: { id: incident.id } } as unknown as Request, {} as Response);
    } catch (err) {
      threw = true;
      assert(err instanceof NotFoundError, `got ${err}`);
    }

    assert(threw);
  });
});
