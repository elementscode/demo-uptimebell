/**
 * The keys your app stores in the session, so `session.get("userId")` is
 * typed. `userId` is the account id: an account is the unit that signs in.
 */
declare module "@elements/app" {
  interface SessionData {
    userId: string;
    userName: string;
    slug: string;
  }
}

export {};
