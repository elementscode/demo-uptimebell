import { sql, tx, session, NotFoundError, ValidationError } from "@elements/app";
import { accountEvents } from "#app/shared/services/events";
import { SendIncidentUpdateJob } from "#app/jobs/send-incident-update";

export type IncidentStatus = "investigating" | "identified" | "resolved";

export const INCIDENT_STATUSES: IncidentStatus[] = ["investigating", "identified", "resolved"];

export interface IncidentUpdate {
  id: string;
  status: IncidentStatus;
  body: string;
  createdAt: Date;
}

export interface Incident {
  id: string;
  title: string;
  status: IncidentStatus;
  monitorId: string | null;
  monitorName: string | null;
  startedAt: Date;
  resolvedAt: Date | null;
  updates: IncidentUpdate[];
}

export interface UpdateForm {
  incidentId: string;
  status: IncidentStatus;
  body: string;
}

export interface DeclareForm {
  title: string;
  monitorId: string;
  status: IncidentStatus;
  body: string;
}

type IncidentRow = Omit<Incident, "updates">;

function withUpdates(rows: IncidentRow[]): Incident[] {
  return rows.map((row) => ({
    ...row,
    updates: sql<IncidentUpdate>(`
      select id, status, body, createdAt
        from incidentUpdates
       where incidentId = ${row.id}
       order by createdAt desc, id desc
    `).all(),
  }));
}

/** Every open incident, and the resolved ones from the last 90 days, newest first. */
export function loadIncidents(accountId: string): Incident[] {
  let rows = sql<IncidentRow>(`
    select i.id, i.title, i.status, i.monitorId, m.name as monitorName, i.startedAt, i.resolvedAt
      from incidents i
      left join monitors m on m.id = i.monitorId
     where i.accountId = ${accountId}
       and (i.status <> 'resolved' or i.startedAt > now() - interval '90 days')
     order by (i.status = 'resolved'), i.startedAt desc
  `).all();

  return withUpdates(rows);
}

export function loadIncident(accountId: string, incidentId: string): Incident {
  let rows = sql<IncidentRow>(`
    select i.id, i.title, i.status, i.monitorId, m.name as monitorName, i.startedAt, i.resolvedAt
      from incidents i
      left join monitors m on m.id = i.monitorId
     where i.accountId = ${accountId}
       and i.id = ${incidentId}
  `).all();

  if (rows.length === 0) {
    throw new NotFoundError("incident not found");
  }

  return withUpdates(rows)[0];
}

/** @rpc */
export function fetchIncidents(): Incident[] {
  return loadIncidents(session.getOrThrow("userId"));
}

/** @rpc */
export function fetchIncident(incidentId: string): Incident {
  return loadIncident(session.getOrThrow("userId"), incidentId);
}

function checkStatus(status: string): IncidentStatus {
  if (!INCIDENT_STATUSES.includes(status as IncidentStatus)) {
    throw new ValidationError({ status: ["pick a status"] });
  }

  return status as IncidentStatus;
}

/**
 * Records an update, moves the incident to its status, and queues one email
 * per subscriber. The jobs join the transaction, so nobody hears about an
 * update that did not commit.
 */
function recordUpdate(accountId: string, incidentId: string, status: IncidentStatus, body: string): string {
  let update = sql<{ id: string }>(`
    insert into incidentUpdates (incidentId, status, body)
         values (${incidentId}, ${status}, ${body})
      returning id
  `).firstOrThrow();

  sql(`
    update incidents
       set status = ${status},
           resolvedAt = case when ${status} = 'resolved' then coalesce(resolvedAt, now()) else null end
     where id = ${incidentId}
  `);

  let subscribers = sql<{ id: string }>(`select id from subscribers where accountId = ${accountId}`).all();

  for (let subscriber of subscribers) {
    new SendIncidentUpdateJob({ updateId: update.id, subscriberId: subscriber.id }).schedule({
      idempotencyKey: `incident-update:${update.id}:${subscriber.id}`,
    });
  }

  return update.id;
}

/** @rpc */
export function postUpdate(form: UpdateForm): Incident {
  let accountId = session.getOrThrow("userId");
  let status = checkStatus(form.status);
  let body = form.body.trim();

  if (!body) {
    throw new ValidationError({ body: ["write what changed"] });
  }

  tx(() => {
    let owned = sql(`select 1 from incidents where id = ${form.incidentId} and accountId = ${accountId}`);

    if (owned.empty()) {
      throw new NotFoundError("incident not found");
    }

    recordUpdate(accountId, form.incidentId, status, body);
  });

  accountEvents.notify({ accountId, kind: "incidents" });

  return loadIncident(accountId, form.incidentId);
}

/** @rpc */
export function declareIncident(form: DeclareForm): Incident {
  let accountId = session.getOrThrow("userId");
  let status = checkStatus(form.status);
  let title = form.title.trim();
  let body = form.body.trim();
  let errors: { title?: string[]; body?: string[] } = {};

  if (!title) {
    errors.title = ["give the incident a title"];
  }

  if (!body) {
    errors.body = ["write a first update"];
  }

  if (errors.title || errors.body) {
    throw new ValidationError(errors);
  }

  let monitorId = form.monitorId || null;

  let incidentId = tx(() => {
    if (monitorId && sql(`select 1 from monitors where id = ${monitorId} and accountId = ${accountId}`).empty()) {
      throw new ValidationError({ monitorId: ["pick one of your monitors"] });
    }

    if (monitorId && !sql(`select 1 from incidents where monitorId = ${monitorId} and status <> 'resolved'`).empty()) {
      throw new ValidationError({ monitorId: ["that monitor already has an open incident"] });
    }

    let incident = sql<{ id: string }>(`
      insert into incidents (accountId, monitorId, title, status)
           values (${accountId}, ${monitorId}, ${title}, ${status})
        returning id
    `).firstOrThrow();

    recordUpdate(accountId, incident.id, status, body);

    return incident.id;
  });

  accountEvents.notify({ accountId, kind: "incidents" });

  return loadIncident(accountId, incidentId);
}
