import { test, assert, sql, Request, Response, NotFoundError } from "@elements/app";
import route from "./index";

test("unsubscribe route", () => {
  test("names the subscriber and the account", () => {
    let account = sql<{ id: string }>(`
      insert into accounts (name, slug, email, passwordHash) values ('Test Co', 'test-co', 'ops@test.test', 'x') returning id
    `).firstOrThrow();
    let subscriber = sql<{ token: string }>(`
      insert into subscribers (accountId, email) values (${account.id}, 'reader@example.com') returning token
    `).firstOrThrow();

    let html = route({ params: { token: subscriber.token } } as unknown as Request, {} as Response).toHtml();

    assert(html.includes("reader@example.com"));
    assert(html.includes("Test Co"));
  });

  test("a used token is a 404", () => {
    let threw = false;

    try {
      route({ params: { token: "nope" } } as unknown as Request, {} as Response);
    } catch (err) {
      threw = true;
      assert(err instanceof NotFoundError, `got ${err}`);
    }

    assert(threw);
  });
});
