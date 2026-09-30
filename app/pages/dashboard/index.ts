import { Request, Response, redirect, session, sql } from "@elements/app";
import { accountEvents } from "#app/shared/services/events";
import { loadMonitors } from "#app/shared/services/monitors";
import { loadIncidents } from "#app/shared/services/incidents";
import html from "./template";

export default function route(req: Request, res: Response) {
  if (!session.isLoggedIn()) {
    redirect("/signin");
    return;
  }

  let accountId = session.getOrThrow("userId");

  // Listen before reading, so a check that lands in between is not lost.
  let listener = accountEvents.listen({ filter: (event) => event.accountId === accountId });

  let subscribers = sql<{ n: number }>(`select count(*)::int as n from subscribers where accountId = ${accountId}`).firstOrThrow();

  return new html({
    listener,
    initialMonitors: loadMonitors(accountId),
    initialIncidents: loadIncidents(accountId),
    subscriberCount: subscribers.n,
  });
}
