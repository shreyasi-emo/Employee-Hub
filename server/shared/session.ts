// Express session middleware, backed by PostgreSQL via connect-pg-simple.
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Express } from "express";
import { pool } from "../db";

const PgSession = connectPgSimple(session);

export function applySession(app: Express) {
  app.use(session({
    store: new PgSession({ pool, tableName: "session", createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || "emo-hris-secret-2024",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
  }));
}
