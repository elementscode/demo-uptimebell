import { Request, Response, redirect, session, sql } from "@elements/app";
import html, { DemoLogin } from "./template";

/**
 * The seeded accounts' password.
 */
const DEMO_PASSWORD = "uptimebell";

export default function route(req: Request, res: Response) {
  if (session.isLoggedIn()) {
    redirect("/dashboard");
    return;
  }

  let demoLogins = sql<DemoLogin>(`
    select id, name, email, ${DEMO_PASSWORD} as password
      from accounts
     where email in ('ops@northwind.test', 'team@lumen.test')
     order by name desc
  `).all();

  return new html({ demoLogins });
}
