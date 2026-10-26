![Uptime monitoring with a status page, built by Claude Code on Elements: the Northwind dashboard with response time charts and uptime for 24 hours, 7 days and 90 days, a Payments monitor down with HTTP 404, and the incident list with an identified incident and past resolved ones.](https://elements.dev/demos/01a0f41f-a528-7e3d-97cb-02e9e521529d/poster?v=4ceaaa864869)

# Uptime monitoring with a status page, built by Claude Code on Elements

> Uptimebell is a full-stack app built with Claude Code on Elements.

Checks your sites every minute, opens an incident after three failures, and runs a status page that emails subscribers.

[Run this app on your machine](https://elements.dev/demos/01a0f41f-a528-7e3d-97cb-02e9e521529d). Use this demo as inspiration, or as the starting point for your own app. Your agent creates a new app with this one as the scaffold, and you prompt it to add whatever features you want.

## How it's built

Uptimebell needed a check of every site each minute, incidents that open on their own, a status page that updates as people watch, and email to subscribers. Each of those is a part of Elements, so the agent spent its 20 minutes on the monitoring itself.

- **Checks on a schedule.** One cron line runs a job every minute that queues one check job per monitor, keyed to the monitor and the minute, so a slow site holds up only its own check.

- **Incidents in one transaction.** Each check records its result, the day's rollup and the monitor's state together, and the third failure in a row opens an incident, posts its first update and schedules the alert email.

- **A live status page.** A channel announces each check and incident. The dashboard and the public status page listen for their own account and re-read through `@rpc` functions, so bars turn red and posted updates appear live.

- **Email to subscribers.** Visitors subscribe from the status page, and each incident update goes out as one background job per subscriber, so a retry reaches only the person it missed.

- **Data from SQL files.** Two migrations define the schema and seed two accounts with eight monitors on reserved example domains, 90 days of checks with outages, the incidents and updates that came from them, and subscribers. Two monitors fail on purpose and stay red.

- **Sessions.** Every dashboard rpc reads the account from the signed-in session.

## Why Elements

Elements is an integrated full-stack app framework and a project server. The project server checks the agent's work as it builds: it type-checks the server and browser code, analyzes the program, applies migrations and runs the tests, then reports the results to the agent. A security mistake, such as calling a server-only function from the browser, is a compile error. The agent reads the report and fixes its own mistakes before it tells you a feature is done. The same checks run on every feature you ask for next.
