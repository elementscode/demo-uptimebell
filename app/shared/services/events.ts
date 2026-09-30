import { Channel } from "@elements/app";

/**
 * "Something changed for this account." The payload names what changed; the
 * dashboard and the status page re-read it through their own rpc, so each
 * applies its own access rules.
 */
export interface AccountEvent {
  accountId: string;
  kind: "check" | "monitors" | "incidents";
  monitorId?: string;
}

export const accountEvents = new Channel<AccountEvent>("account-events");
