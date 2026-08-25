import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
});

// Neon (and other serverless Postgres) drop idle connections. node-postgres emits
// an 'error' on the idle client; without a listener this becomes an uncaught
// exception and crashes the process. Log and let the pool reconnect on next query.
pool.on("error", (err) => {
  console.error("[db] idle client error (pool will reconnect):", err.message);
});

export const db = drizzle(pool, { schema });
export { pool };
