import { sql, NotFoundError, ValidationError } from "@elements/app";
import { MonitorStatus } from "#app/shared/services/monitors";
import { Incident, loadIncidents } from "#app/shared/services/incidents";

export const BAR_DAYS = 90;

/** One day of one component. `day` is a UTC date, "2026-09-30". */
export interface DayBar {
  day: string;
  checks: number;
  failures: number;
}

export interface StatusComponent {
  id: string;
  name: string;
  status: MonitorStatus;
  uptime90: number | null;
  days: DayBar[];
}

export interface StatusAccount {
  id: string;
  name: string;
  slug: string;
}

export function loadAccount(slug: string): StatusAccount {
  let account = sql<StatusAccount>(`select id, name, slug from accounts where slug = ${slug}`).first();

  if (!account) {
    throw new NotFoundError(`no status page named ${slug}`);
  }

  return account;
}

function loadComponent(monitor: { id: string; name: string; status: MonitorStatus }): StatusComponent {
  let days = sql<DayBar>(`
    select to_char(d.day, 'YYYY-MM-DD') as day,
           coalesce(md.checks, 0) as checks,
           coalesce(md.failures, 0) as failures
      from generateSeries((now() at time zone 'utc')::date - ${BAR_DAYS - 1}::int,
                          (now() at time zone 'utc')::date,
                          interval '1 day') as d(day)
      left join monitorDays md on md.monitorId = ${monitor.id} and md.day = d.day::date
     order by d.day
  `).all();

  let checks = days.reduce((sum, d) => sum + d.checks, 0);
  let failures = days.reduce((sum, d) => sum + d.failures, 0);

  return {
    ...monitor,
    uptime90: checks > 0 ? (checks - failures) / checks : null,
    days,
  };
}

/** The components are the account's monitors. Urls stay private. */
export function loadComponents(accountId: string): StatusComponent[] {
  let monitors = sql<{ id: string; name: string; status: MonitorStatus }>(`
    select id, name, status from monitors where accountId = ${accountId} order by createdAt
  `).all();

  return monitors.map(loadComponent);
}

/** @rpc */
export function fetchComponents(slug: string): StatusComponent[] {
  return loadComponents(loadAccount(slug).id);
}

/** @rpc */
export function fetchComponent(slug: string, monitorId: string): StatusComponent | null {
  let account = loadAccount(slug);
  let monitor = sql<{ id: string; name: string; status: MonitorStatus }>(`
    select id, name, status from monitors where id = ${monitorId} and accountId = ${account.id}
  `).first();

  return monitor ? loadComponent(monitor) : null;
}

/** @rpc */
export function fetchPublicIncidents(slug: string): Incident[] {
  return loadIncidents(loadAccount(slug).id);
}

/**
 * Subscribing twice is not an error: the second call finds the row and says
 * the same thing, so the form cannot be used to learn who is subscribed.
 *
 * @rpc
 */
export function subscribe(slug: string, email: string) {
  let address = email.trim().toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
    throw new ValidationError("enter a valid email address");
  }

  let account = loadAccount(slug);

  sql(`
    insert into subscribers (accountId, email)
         values (${account.id}, ${address})
    on conflict (accountId, email) do nothing
  `);
}

/**
 * A button on the unsubscribe page calls this rather than the link doing it on
 * GET, so a mail scanner that follows links cannot unsubscribe anyone.
 *
 * @rpc
 */
export function unsubscribe(token: string) {
  sql(`delete from subscribers where token = ${token}`);
}
