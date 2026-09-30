import { test, assert, Request, Response } from "@elements/app";
import route from "./index";

test("signin route", () => {
  test("renders the form with no demo logins when the seed is absent", () => {
    let html = route({ params: {} } as unknown as Request, {} as Response)!.toHtml();

    assert(html.includes("Sign in"));
    assert(!html.includes("Demo accounts"), "the test database has no seeded accounts");
  });
});
