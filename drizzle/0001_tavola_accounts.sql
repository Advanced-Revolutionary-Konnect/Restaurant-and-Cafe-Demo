CREATE TABLE tavola_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  salt TEXT NOT NULL,
  verifier TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE tavola_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES tavola_accounts(id),
  expires INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE tavola_attempts (
  bucket TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
