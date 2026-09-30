-- add uptime schema

-- Auto-update updatedAt on row changes.
create or replace function touchUpdatedAt()
returns trigger
language plpgsql
as $$
begin
  new.updatedAt = now();
  return new;
end;
$$;

create table accounts (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  name text not null,
  slug text not null unique,
  email text not null unique,
  passwordHash text not null
);

create trigger accountsTouchUpdatedAt
  before update on accounts
  for each row execute function touchUpdatedAt();

create table monitors (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  accountId uuid not null references accounts(id) on delete cascade,
  name text not null,
  url text not null,
  status text not null default 'pending' check (status in ('pending', 'up', 'down')),
  consecutiveFailures integer not null default 0,
  lastCheckedAt timestamptz,
  lastResponseMs integer,
  lastStatusCode integer,
  lastError text
);

create index monitorsAccountIdx on monitors (accountId, createdAt);

create trigger monitorsTouchUpdatedAt
  before update on monitors
  for each row execute function touchUpdatedAt();

-- One row per request. The dashboard reads the last 24 hours of these.
create table checks (
  id bigint generated always as identity primary key,
  monitorId uuid not null references monitors(id) on delete cascade,
  checkedAt timestamptz not null default now(),
  ok boolean not null,
  statusCode integer,
  responseMs integer,
  error text
);

create index checksMonitorTimeIdx on checks (monitorId, checkedAt desc);

-- A daily rollup, so a 90-day bar and 90-day uptime read 90 rows per monitor
-- instead of every check in the window.
create table monitorDays (
  monitorId uuid not null references monitors(id) on delete cascade,
  day date not null,
  checks integer not null default 0,
  failures integer not null default 0,
  primary key (monitorId, day)
);

create table incidents (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  accountId uuid not null references accounts(id) on delete cascade,
  monitorId uuid references monitors(id) on delete set null,
  title text not null,
  status text not null check (status in ('investigating', 'identified', 'resolved')),
  startedAt timestamptz not null default now(),
  resolvedAt timestamptz
);

create index incidentsAccountIdx on incidents (accountId, startedAt desc);

-- At most one open incident per monitor, so a failing monitor cannot pile them up.
create unique index incidentsOneOpenPerMonitor on incidents (monitorId) where status <> 'resolved';

create trigger incidentsTouchUpdatedAt
  before update on incidents
  for each row execute function touchUpdatedAt();

create table incidentUpdates (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  incidentId uuid not null references incidents(id) on delete cascade,
  status text not null check (status in ('investigating', 'identified', 'resolved')),
  body text not null
);

create index incidentUpdatesIncidentIdx on incidentUpdates (incidentId, createdAt);

create trigger incidentUpdatesTouchUpdatedAt
  before update on incidentUpdates
  for each row execute function touchUpdatedAt();

create table subscribers (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  accountId uuid not null references accounts(id) on delete cascade,
  email text not null,
  token text not null unique default encode(genRandomBytes(18), 'hex'),
  unique (accountId, email)
);

create trigger subscribersTouchUpdatedAt
  before update on subscribers
  for each row execute function touchUpdatedAt();
