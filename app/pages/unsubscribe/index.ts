import { Request, Response, sql, NotFoundError } from "@elements/app";
import html from "./template";

export default function route(req: Request, res: Response) {
  let row = sql<{ email: string; accountName: string; slug: string }>(`
    select s.email, a.name as accountName, a.slug
      from subscribers s
      join accounts a on a.id = s.accountId
     where s.token = ${req.params.token}
  `).first();

  if (!row) {
    throw new NotFoundError("that unsubscribe link has already been used");
  }

  return new html({ token: req.params.token, ...row });
}
