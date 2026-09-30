import { Request, Response, redirect, session, sql } from "@elements/app";
import { accountEvents } from "#app/shared/services/events";
import { loadIncident } from "#app/shared/services/incidents";
import html from "./template";

export default function route(req: Request, res: Response) {
  if (!session.isLoggedIn()) {
    redirect("/signin");
    return;
  }

  let accountId = session.getOrThrow("userId");
  let listener = accountEvents.listen({ filter: (event) => event.accountId === accountId });
  let subscribers = sql<{ n: number }>(`select count(*)::int as n from subscribers where accountId = ${accountId}`).firstOrThrow();

  return new html({
    listener,
    initial: loadIncident(accountId, req.params.id),
    subscriberCount: subscribers.n,
  });
}
