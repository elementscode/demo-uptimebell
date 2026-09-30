import { Job, sql } from "@elements/app";
import { CheckMonitorJob } from "#app/jobs/check-monitor";

export interface ScheduleChecksJobFields {}

/**
 * Fans the minute's checks out to one job per monitor, so a slow url holds up
 * only its own check. The key is the monitor and the minute, so a duplicate
 * tick cannot check a monitor twice.
 */
export class ScheduleChecksJob extends Job<ScheduleChecksJobFields> {
  run() {
    let minute = new Date();
    minute.setUTCSeconds(0, 0);

    let monitors = sql<{ id: string }>(`select id from monitors`).all();

    for (let monitor of monitors) {
      new CheckMonitorJob({ monitorId: monitor.id }).schedule({
        idempotencyKey: `check:${monitor.id}:${minute.toISOString()}`,
      });
    }
  }
}
