import { Request, Response, redirect, session } from "@elements/app";

/** The app has no landing page: `/` goes to the dashboard or to sign-in. */
export default function route(req: Request, res: Response) {
  redirect(session.isLoggedIn() ? "/dashboard" : "/signin");
}
