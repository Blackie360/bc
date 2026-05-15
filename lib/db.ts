import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { getDatabaseConfig } from "@/lib/db-config";
import * as schema from "@/lib/db/schema";

type Database = MySql2Database<typeof schema>;

const globalForDb = globalThis as unknown as {
  db?: Database;
  mysqlPool?: mysql.Pool;
};

function createPool() {
  const config = getDatabaseConfig();

  return mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: 5,
    connectTimeout: 30_000,
    waitForConnections: true,
  });
}

export function getDb(): Database {
  if (!globalForDb.mysqlPool) {
    globalForDb.mysqlPool = createPool();
  }

  if (!globalForDb.db) {
    globalForDb.db = drizzle(globalForDb.mysqlPool, { schema, mode: "default" });
  }

  return globalForDb.db;
}
