import { test, assert, equal, sql, session, AuthError } from "@elements/app";
import { signin, signup, slugify } from "#app/shared/services/auth";

test("auth", () => {
  test("slugify", () => {
    equal(slugify("Lumen Labs"), "lumen-labs");
    equal(slugify("  Acme, Inc.  "), "acme-inc");
  });

  test("signup creates an account with a status page slug and signs in", () => {
    signup({ name: "Acme Inc", email: "Ops@Acme.test", password: "longenough" });

    let row = sql<{ slug: string; email: string }>(`select slug, email from accounts where email = 'ops@acme.test'`).firstOrThrow();
    equal(row.slug, "acme-inc");
    equal(session.get("slug"), "acme-inc");
  });

  test("signin checks the password", () => {
    signup({ name: "Acme", email: "ops@acme.test", password: "longenough" });
    session.logout();

    let threw = false;

    try {
      signin("ops@acme.test", "wrong-password");
    } catch (err) {
      threw = true;
      assert(err instanceof AuthError, `got ${err}`);
    }

    assert(threw);

    signin("OPS@acme.test", "longenough");
    assert(session.isLoggedIn());
  });
});
