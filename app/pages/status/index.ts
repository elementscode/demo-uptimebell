import { Request, Response } from "@elements/app";
import { accountEvents } from "#app/shared/services/events";
import { loadIncidents } from "#app/shared/services/incidents";
import { loadAccount, loadComponents } from "#app/shared/services/status-page";
import html from "./template";

export default function route(req: Request, res: Response) {
  let account = loadAccount(req.params.slug);
  let listener = accountEvents.listen({ filter: (event) => event.accountId === account.id });

  return new html({
    account,
    listener,
    initialComponents: loadComponents(account.id),
    initialIncidents: loadIncidents(account.id),
  });
}
