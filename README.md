![Uptimebell, an uptime monitor built with Elements: the Northwind dashboard with response time charts and uptime for 24 hours, 7 days and 90 days, a Payments monitor down with HTTP 404, and the incident list with an identified incident and past resolved ones.](https://elements.dev/demos/01a0f41f-a528-7e3d-97cb-02e9e521529d/poster?v=4ceaaa864869)

# Uptimebell

> A demo app built with [Elements](https://elements.dev).

Checks your sites every minute, opens an incident after three failures, and runs a status page that emails subscribers.

**Demo:** [Uptimebell](https://elements.dev/demos/01a0f41f-a528-7e3d-97cb-02e9e521529d)

## Agent specs

- **Agent:** Claude Code, Opus 5.5 Medium
- **Time:** 20 min
- **Cost:** $6.06 at API rates, September 2026

## Get started

```bash
elements create uptimebell -scaffold=elementscode/demo-uptimebell
```

## How it's built

Uptimebell needed a check of every site each minute, incidents that open on their own, a status page that updates as people watch, and email to subscribers. Each of those is a part of Elements, so the agent spent its 20 minutes on the monitoring itself.

### What Elements gave the app

- **Checks on a schedule.** One cron line runs a job every minute that queues one check job per monitor, keyed to the monitor and the minute, so a slow site holds up only its own check.

- **Incidents in one transaction.** Each check records its result, the day's rollup and the monitor's state together, and the third failure in a row opens an incident, posts its first update and schedules the alert email.

- **A live status page.** A channel announces each check and incident. The dashboard and the public status page listen for their own account and re-read through `@rpc` functions, so bars turn red and posted updates appear live.

- **Email to subscribers.** Visitors subscribe from the status page, and each incident update goes out as one background job per subscriber, so a retry reaches only the person it missed.

- **Data from SQL files.** Two migrations define the schema and seed two accounts with eight monitors on reserved example domains, 90 days of checks with outages, the incidents and updates that came from them, and subscribers. Two monitors fail on purpose and stay red.

- **Sessions.** Every dashboard rpc reads the account from the signed-in session.

### What the project server gave the agent

The project server runs alongside the agent and answers as soon as a file is saved: it type-checks the templates, TypeScript and SQL, applies migrations and reruns the tests, so every question came back right away and the agent kept building.

### What shipped

The app type-checks with zero errors and all 29 tests pass. Every page works on desktop and phone, and live updates arrive across tabs, such as an incident update reaching an open status page.

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

**Demo:** [Uptimebell](https://elements.dev/demos/01a0f41f-a528-7e3d-97cb-02e9e521529d)

## License

MIT. See [LICENSE](LICENSE).
