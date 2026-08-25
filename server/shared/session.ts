// Express session middleware, backed by PostgreSQL via connect-pg-simple.
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Express } from "express";
import { pool } from "../db";

const PgSession = connectPgSimple(session);

export function applySession(app: Express) {
  app.use(session({
    store: new PgSession({ pool, tableName: "session", createTableIfMissing: true }),
    // Required — validated/ensured at startup (server/index.ts); no in-repo fallback.
    secret: process.env.SESSION_SECRET as string,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // Secure cookie over HTTPS in prod (needs trust proxy)
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  }));
}
