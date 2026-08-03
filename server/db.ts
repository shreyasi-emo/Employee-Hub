import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

// On serverless (Netlify Functions run on AWS Lambda) each warm container keeps
// its own pool, so we cap it hard to avoid exhausting Postgres connections
// across many concurrent invocations. Use a POOLED DATABASE_URL (e.g. Neon's
// pooled endpoint / PgBouncer) in that environment.
const isServerless =
  !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.LAMBDA_TASK_ROOT || !!process.env.NETLIFY;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: isServerless ? 1 : 10,
  idleTimeoutMillis: isServerless ? 10_000 : 30_000,
  connectionTimeoutMillis: 10_000,
});

// Neon (and other serverless Postgres) drop idle connections. node-postgres emits
// an 'error' on the idle client; without a listener this becomes an uncaught
// exception and crashes the process. Log and let the pool reconnect on next query.
pool.on("error", (err) => {
  console.error("[db] idle client error (pool will reconnect):", err.message);
});

export const db = drizzle(pool, { schema });
export { pool };
