![Uptimebell, an uptime monitor built with Elements: the Northwind dashboard with response time charts and uptime for 24 hours, 7 days and 90 days, a Payments monitor down with HTTP 404, and the incident list with an identified incident and past resolved ones.](https://elements.dev/demos/01a0f41f-a528-7e3d-97cb-02e9e521529d/poster?v=4ceaaa864869)

# Uptimebell

> A demo app built with [Elements](https://elements.dev).

Checks your sites every minute, opens an incident after three failures, and runs a status page that emails subscribers.

**Demo:** [Uptimebell](https://elements.dev/demos/01a0f41f-a528-7e3d-97cb-02e9e521529d)

## Agent specs

What one run of the prompt below took, from an empty Elements project to this
app.

- **Agent:** Claude Code, Opus 5.5 Medium
- **Time:** 20 min
- **Cost:** $6.06 at API rates, September 2026

## Get started

```bash
elements create uptimebell -scaffold=elementscode/demo-uptimebell
```

## Seed data and demo accounts

The seed creates two accounts, each with four monitors, 90 days of check
history (every five minutes, then every minute for the last 24 hours), past
incidents with their updates, and a few status page subscribers. Both
passwords are `uptimebell`, and the sign-in page lists them.

| Email              | Account    | Status page         |
| ------------------ | ---------- | ------------------- |
| ops@northwind.test | Northwind  | `/status/northwind` |
| team@lumen.test    | Lumen Labs | `/status/lumen`     |

The background job checks every monitor once a minute. The seeded monitors
point only at reserved example domains (`example.com`, `example.org`,
`example.net` and their `www` hosts), so the app never loads a real site. Two
fail on purpose: Northwind's Payments checks `https://example.com/payments/health`,
which returns 404, and Lumen Labs' Webhooks checks
`https://hooks.lumen-labs.invalid/health`, which cannot resolve. Within three
minutes of starting, Webhooks opens a live incident and emails the account.

## The prompt

```text
Build an uptime monitor and status page named uptimebell.

- Accounts; each account adds monitors: a name and a url, checked every
  minute.
- A background job requests each url and records response time and status.
  Three failures in a row opens an incident and emails the account.
- Dashboard: each monitor's current status, response time chart for the last
  24 hours, and uptime for 24 hours, 7 days and 90 days.
- A public status page per account with a component list, a 90-day bar per
  component, and incidents.
- Post incident updates (investigating, identified, resolved); subscribers to
  the status page get them by email.

Seed two accounts with monitors (some pointing at urls that fail), 90 days of
check history, and past incidents. Show the seeded logins on the sign-in page.

Statuses, charts and incidents update in real time on the dashboard and the
status page.
```

## License

MIT. See [LICENSE](LICENSE).
