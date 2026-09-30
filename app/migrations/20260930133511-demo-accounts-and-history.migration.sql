/** @env development */

-- Two demo accounts. Both passwords are "uptimebell"; the sign-in page lists them.
insert into accounts (name, slug, email, passwordHash)
     values ('Northwind', 'northwind', 'ops@northwind.test', crypt('uptimebell', genSalt('bf', 12))),
            ('Lumen Labs', 'lumen', 'team@lumen.test', crypt('uptimebell', genSalt('bf', 12)));

-- Every url is a reserved example domain or an .invalid host, so the minute
-- checks never load a real site. Payments (a 404 path on example.com) and
-- Webhooks (a host that cannot resolve) fail on purpose and stay red.
insert into monitors (accountId, name, url, createdAt)
select a.id, m.name, m.url, now() - interval '91 days' + (m.ord * interval '1 minute')
  from (values
    ('northwind', 1, 'Website', 'https://example.com'),
    ('northwind', 3, 'API', 'https://www.example.com'),
    ('northwind', 4, 'Docs', 'https://example.org'),
    ('northwind', 2, 'Payments', 'https://example.com/payments/health'),
    ('lumen', 1, 'App', 'https://example.net'),
    ('lumen', 2, 'Status API', 'https://www.example.org'),
    ('lumen', 3, 'CDN', 'https://www.example.net'),
    ('lumen', 4, 'Webhooks', 'https://hooks.lumen-labs.invalid/health')
  ) as m(slug, ord, name, url)
  join accounts a on a.slug = m.slug;

-- Outage windows, in minutes ago. The checks inside a window fail, and each one
-- but the last becomes a resolved incident below.
create temp table seedOutages (
  slug text,
  monitorName text,
  startsAgo integer,
  lengthMinutes integer,
  statusCode integer,
  error text
);

insert into seedOutages
     values ('northwind', 'API', 12 * 1440 + 310, 47, 502, null),
            ('northwind', 'Website', 38 * 1440 + 95, 22, null, 'connect ETIMEDOUT'),
            ('northwind', 'Docs', 71 * 1440 + 600, 120, 500, null),
            ('northwind', 'API', 55 * 1440 + 200, 14, 503, null),
            ('northwind', 'Payments', 25, 100000, 404, null),
            ('lumen', 'App', 5 * 1440 + 420, 35, 500, null),
            ('lumen', 'CDN', 20 * 1440 + 180, 60, null, 'socket hang up'),
            ('lumen', 'Status API', 60 * 1440 + 30, 15, 503, null),
            ('lumen', 'Webhooks', 83 * 1440 + 800, 90, null, 'getaddrinfo ENOTFOUND');

select setseed(0.42);

-- Every five minutes for 90 days, then every minute for the last 24 hours.
with base as (
  select m.id,
         m.name,
         a.slug,
         case m.name
           when 'Website' then 140
           when 'API' then 210
           when 'Docs' then 320
           when 'Payments' then 260
           when 'App' then 180
           when 'Status API' then 60
           when 'CDN' then 45
           else 230
         end as baseMs
    from monitors m
    join accounts a on a.id = m.accountId
),
times as (
  select t
    from generateSeries(date_trunc('minute', now()) - interval '90 days',
                        date_trunc('minute', now()) - interval '24 hours',
                        interval '5 minutes') as t
  union all
  select t
    from generateSeries(date_trunc('minute', now()) - interval '24 hours' + interval '1 minute',
                        date_trunc('minute', now()),
                        interval '1 minute') as t
),
samples as (
  select b.id,
         b.baseMs,
         t.t,
         o.statusCode as outageCode,
         o.error as outageError,
         (o.slug is not null) as inOutage,
         random() as r
    from base b
   cross join times t
    left join seedOutages o
      on o.slug = b.slug
     and o.monitorName = b.name
     and t.t >= date_trunc('minute', now()) - o.startsAgo * interval '1 minute'
     and t.t < date_trunc('minute', now()) - (o.startsAgo - o.lengthMinutes) * interval '1 minute'
)
insert into checks (monitorId, checkedAt, ok, statusCode, responseMs, error)
select id,
       t,
       not (inOutage or r < 0.00012),
       case
         when inOutage then outageCode
         when r < 0.00012 then 502
         else 200
       end,
       case
         when inOutage and outageError is not null then null
         else round(baseMs
                    * (1 + 0.18 * sin(extract(epoch from t) / 86400 * 2 * pi()))
                    * (0.85 + random() * 0.4)
                    * case when random() < 0.01 then 2.6 else 1 end)::int
       end,
       case when inOutage then coalesce(outageError, 'HTTP ' || outageCode) when r < 0.00012 then 'HTTP 502' end
  from samples;

insert into monitorDays (monitorId, day, checks, failures)
select monitorId,
       (checkedAt at time zone 'utc')::date,
       count(*),
       count(*) filter (where not ok)
  from checks
 group by 1, 2;

update monitors m
   set status = case when c.ok then 'up' else 'down' end,
       lastCheckedAt = c.checkedAt,
       lastResponseMs = c.responseMs,
       lastStatusCode = c.statusCode,
       lastError = c.error,
       consecutiveFailures = case when c.ok then 0 else 25 end
  from (select distinct on (monitorId) *
          from checks
         order by monitorId, checkedAt desc) c
 where c.monitorId = m.id;

insert into incidents (accountId, monitorId, title, status, startedAt, resolvedAt, createdAt)
select a.id,
       m.id,
       i.title,
       case when i.lengthMinutes is null then 'identified' else 'resolved' end,
       date_trunc('minute', now()) - i.startsAgo * interval '1 minute',
       date_trunc('minute', now()) - (i.startsAgo - i.lengthMinutes) * interval '1 minute',
       date_trunc('minute', now()) - i.startsAgo * interval '1 minute'
  from (values
    ('northwind', 'API', 'Elevated error rates on the API', 12 * 1440 + 310, 47),
    ('northwind', 'Website', 'Website unreachable from some regions', 38 * 1440 + 95, 22),
    ('northwind', 'Docs', 'Docs returning server errors', 71 * 1440 + 600, 120),
    ('northwind', 'Payments', 'Payments failing at checkout', 25, null),
    ('lumen', 'App', 'Sign-in failures in the app', 5 * 1440 + 420, 35),
    ('lumen', 'CDN', 'Slow and failing asset delivery', 20 * 1440 + 180, 60),
    ('lumen', 'Status API', 'Status API unavailable', 60 * 1440 + 30, 15)
  ) as i(slug, monitorName, title, startsAgo, lengthMinutes)
  join accounts a on a.slug = i.slug
  join monitors m on m.accountId = a.id and m.name = i.monitorName;

insert into incidentUpdates (incidentId, status, body, createdAt)
select i.id, u.status, u.body, i.startedAt + u.afterMinutes * interval '1 minute'
  from incidents i
 cross join lateral (values
    ('investigating', 'We are seeing failed checks and are looking into it.', 3),
    ('identified', case i.title
                     when 'Payments failing at checkout' then 'The payments health check is returning 404 after a routing change. We are rolling it back.'
                     when 'Elevated error rates on the API' then 'A bad deploy raised 502s from the API. We are rolling it back.'
                     when 'Website unreachable from some regions' then 'A CDN route in Frankfurt was dropping connections. Traffic is being moved.'
                     when 'Docs returning server errors' then 'The docs search index ran out of disk. We are expanding it.'
                     when 'Sign-in failures in the app' then 'An expired certificate on the session service. A new one is rolling out.'
                     when 'Slow and failing asset delivery' then 'An upstream provider is degraded. We have failed over to a second origin.'
                     else 'A database failover left the service without a primary. It has been promoted.'
                   end,
     least(12, coalesce(extract(epoch from (i.resolvedAt - i.startedAt))::int / 120, 12))),
    ('resolved', 'Checks have been passing for 15 minutes. This incident is resolved.',
     coalesce(extract(epoch from (i.resolvedAt - i.startedAt))::int / 60, 0))
  ) as u(status, body, afterMinutes)
 where u.status <> 'resolved' or i.status = 'resolved';

insert into subscribers (accountId, email)
select a.id, s.email
  from (values
    ('northwind', 'dana@customer.test'),
    ('northwind', 'lee@customer.test'),
    ('northwind', 'sam@partner.test'),
    ('lumen', 'riley@customer.test'),
    ('lumen', 'ops@agency.test')
  ) as s(slug, email)
  join accounts a on a.slug = s.slug;

drop table seedOutages;
