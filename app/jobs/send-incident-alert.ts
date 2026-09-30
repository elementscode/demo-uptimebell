import { Job, email, sql } from "@elements/app";
import IncidentOpenedEmail from "#app/emails/incident-opened";

export interface SendIncidentAlertJobFields {
  incidentId: string;
}

/**
 * Tells the account that one of its monitors opened an incident.
 */
export class SendIncidentAlertJob extends Job<SendIncidentAlertJobFields> {
  static maxAttempts = 5;

  run() {
    let row = sql<{
      accountName: string;
      accountEmail: string;
      monitorName: string;
      url: string;
      lastError: string | null;
    }>(`
      select a.name as accountName,
             a.email as accountEmail,
             m.name as monitorName,
             m.url,
             m.lastError
        from incidents i
        join accounts a on a.id = i.accountId
        join monitors m on m.id = i.monitorId
       where i.id = ${this.fields.incidentId}
    `).first();

    if (!row) {
      return;
    }

    email({
      to: row.accountEmail,
      subject: `${row.monitorName} is down`,
      body: new IncidentOpenedEmail({
        accountName: row.accountName,
        monitorName: row.monitorName,
        url: row.url,
        reason: row.lastError ?? "no response",
        incidentId: this.fields.incidentId,
      }),
    });
  }
}
