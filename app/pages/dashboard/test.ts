import { test, assert, sql, session, Request, Response } from "@elements/app";
import route from "./index";

test("dashboard route", () => {
  test("shows the account's monitors and incidents", () => {
    let account = sql<{ id: string }>(`
      insert into accounts (name, slug, email, passwordHash) values ('Test Co', 'test-co', 'ops@test.test', 'x') returning id
    `).firstOrThrow();

    let monitor = sql<{ id: string }>(`
      insert into monitors (accountId, name, url, status) values (${account.id}, 'Checkout', 'https://shop.test', 'down') returning id
    `).firstOrThrow();

    sql(`insert into incidents (accountId, monitorId, title, status) values (${account.id}, ${monitor.id}, 'Checkout is down', 'investigating')`);

    session.login({ userId: account.id, userName: "Test Co", slug: "test-co" });

    let html = route({ params: {} } as unknown as Request, {} as Response)!.toHtml();

    assert(html.includes("Checkout"), "lists the monitor");
    assert(html.includes("Checkout is down"), "lists the incident");
    assert(html.includes("monitor-card is-down"), "marks the monitor as down");
  });
});
