import { Job, email, sql } from "@elements/app";
import IncidentUpdateEmail from "#app/emails/incident-update";

export interface SendIncidentUpdateJobFields {
  updateId: string;
  subscriberId: string;
}

/**
 * One incident update to one subscriber. One job per recipient keeps a retry
 * from re-sending to everyone who already got it.
 */
export class SendIncidentUpdateJob extends Job<SendIncidentUpdateJobFields> {
  static maxAttempts = 5;

  run() {
    let row = sql<{
      accountName: string;
      slug: string;
      title: string;
      status: string;
      body: string;
      createdAt: Date;
      email: string;
      token: string;
    }>(`
      select a.name as accountName,
             a.slug,
             i.title,
             u.status,
             u.body,
             u.createdAt,
             s.email,
             s.token
        from incidentUpdates u
        join incidents i on i.id = u.incidentId
        join accounts a on a.id = i.accountId
        join subscribers s on s.accountId = a.id
       where u.id = ${this.fields.updateId}
         and s.id = ${this.fields.subscriberId}
    `).first();

    // The subscriber unsubscribed before the job ran.
    if (!row) {
      return;
    }

    email({
      to: row.email,
      subject: `[${row.accountName}] ${row.title}: ${row.status}`,
      body: new IncidentUpdateEmail({
        accountName: row.accountName,
        slug: row.slug,
        title: row.title,
        status: row.status,
        body: row.body,
        postedAt: row.createdAt,
        token: row.token,
      }),
    });
  }
}
