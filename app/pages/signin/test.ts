import { test, assert, Request, Response } from "@elements/app";
import route from "./index";

test("signin route", () => {
  test("renders the form with the seeded demo logins", () => {
    let html = route({ params: {} } as unknown as Request, {} as Response)!.toHtml();

    assert(html.includes("Sign in"));
    assert(html.includes("Demo accounts"), "the seeded accounts are listed");
    assert(html.includes("ops@northwind.test"));
  });
});
