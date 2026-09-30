import { test, equal } from "@elements/app";
import { formatUptime, formatMs, timeAgo, formatDuration } from "#app/shared/format";

test("format", () => {
  test("uptime rounds down so one failure never reads 100%", () => {
    equal(formatUptime(1), "100%");
    equal(formatUptime(0.99999), "99.99%");
    equal(formatUptime(0.5), "50.00%");
    equal(formatUptime(null), "—");
  });

  test("response time", () => {
    equal(formatMs(84), "84 ms");
    equal(formatMs(1530), "1.53 s");
    equal(formatMs(null), "—");
  });

  test("relative time and duration", () => {
    let now = Date.parse("2026-09-30T12:00:00Z");

    equal(timeAgo(new Date(now - 2000), now), "just now");
    equal(timeAgo(new Date(now - 30000), now), "30s ago");
    equal(timeAgo(new Date(now - 5 * 60000), now), "5m ago");
    equal(formatDuration(new Date(now - 47 * 60000), new Date(now), now), "47 min");
    equal(formatDuration(new Date(now - 125 * 60000), null, now), "2 h 5 min");
  });
});
