import { test, assert, sql, Request, Response, NotFoundError } from "@elements/app";
import route from "./index";

function request(slug: string): Request {
  return { params: { slug } } as unknown as Request;
}

test("status page route", () => {
  test("renders a known account", () => {
    // Slugs and emails are unique, and test files run at once against one
    // database, so the account gets its own.
    let slug = `test-co-${crypto.randomUUID().slice(0, 8)}`;
    sql(`insert into accounts (name, slug, email, passwordHash) values ('Test Co', ${slug}, ${`${slug}@test.test`}, 'x')`);

    let page = route(request(slug), {} as Response);
    let html = page.toHtml();

    assert(html.includes("Test Co status"), "the page names the account");
    assert(html.includes("All systems operational"), "no monitors down");
  });

  test("an unknown slug is a 404", () => {
    let threw = false;

    try {
      route(request("nobody"), {} as Response);
    } catch (err) {
      threw = true;
      assert(err instanceof NotFoundError, `got ${err}`);
    }

    assert(threw);
  });
});
