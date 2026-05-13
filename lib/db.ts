import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";

type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  db?: Database;
  pgPool?: Pool;
};

function createPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to initialize Drizzle.");
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
    max: 5,
  });
}

export function getDb(): Database {
  if (!globalForDb.pgPool) {
    globalForDb.pgPool = createPool();
  }

  if (!globalForDb.db) {
    globalForDb.db = drizzle(globalForDb.pgPool, { schema });
  }

  return globalForDb.db;
}
