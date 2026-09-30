import { sql, session, AuthError, SqlError } from "@elements/app";

interface Account {
  id: string;
  name: string;
  slug: string;
}

export const MIN_PASSWORD = 8;

export interface SignupForm {
  name: string;
  email: string;
  password: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

/** Turns "Lumen Labs" into "lumen-labs" for the public status page url. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function login(account: Account) {
  session.login({ userId: account.id, userName: account.name, slug: account.slug });
}

/** @rpc */
export function signin(email: string, password: string) {
  let address = normalizeEmail(email);

  if (!address || !password) {
    throw new AuthError("enter your email and password");
  }

  let account = sql<Account>(`
    select id, name, slug from accounts
     where email = ${address}
       and passwordHash = crypt(${password}, passwordHash)
  `).first();

  if (!account) {
    throw new AuthError("invalid email or password");
  }

  login(account);
}

/** @rpc */
export function signup(form: SignupForm) {
  let name = form.name.trim();
  let address = normalizeEmail(form.email);
  let slug = slugify(name);

  if (!name || !slug) {
    throw new AuthError("enter a name for your status page");
  }

  if (!isEmail(address)) {
    throw new AuthError("enter a valid email address");
  }

  if (form.password.length < MIN_PASSWORD) {
    throw new AuthError(`password must be at least ${MIN_PASSWORD} characters`);
  }

  if (!sql(`select 1 from accounts where email = ${address}`).empty()) {
    throw new AuthError("that email is already registered");
  }

  if (!sql(`select 1 from accounts where slug = ${slug}`).empty()) {
    throw new AuthError(`the status page name "${slug}" is taken`);
  }

  try {
    let account = sql<Account>(`
      insert into accounts (name, slug, email, passwordHash)
           values (${name}, ${slug}, ${address}, crypt(${form.password}, genSalt('bf', 12)))
        returning id, name, slug
    `).firstOrThrow();

    login(account);
  } catch (err) {
    if (err instanceof SqlError) {
      throw new AuthError("that account already exists");
    }

    throw err;
  }
}

/** @rpc */
export function signout() {
  session.logout();
}
