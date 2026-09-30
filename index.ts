import { App } from "@elements/app";
import config from "#config";
import home from "#app/pages/home";
import signin from "#app/pages/signin";
import signup from "#app/pages/signup";
import dashboard from "#app/pages/dashboard";
import incident from "#app/pages/incident";
import status from "#app/pages/status";
import unsubscribe from "#app/pages/unsubscribe";
import notFound from "#app/pages/errors/not-found";
import unhandled from "#app/pages/errors/unhandled";
import { ScheduleChecksJob } from "#app/jobs/schedule-checks";

const app = new App();

app.route("/", home);
app.route("/signin", signin);
app.route("/signup", signup);
app.route("/dashboard", dashboard);
app.route("/incidents/:id", incident);
app.route("/status/:slug", status);
app.route("/unsubscribe/:token", unsubscribe);

app.cron("every 1m", "check monitors", () => new ScheduleChecksJob().schedule());

app.error((req, res, err) => {
  switch (err.statusCode) {
    case 404:
      return notFound(req, res, err);

    default:
      return unhandled(req, res, err);
  }
});

app.start(config);
