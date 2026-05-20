import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { getDatabaseConfig } from "@/lib/db-config";
import * as schema from "@/lib/db/schema";

type Database = MySql2Database<typeof schema>;
type DatabaseConfig = ReturnType<typeof getDatabaseConfig>;

const globalForDb = globalThis as unknown as {
  db?: Database;
  mysqlPool?: mysql.Pool;
  dbConfigSignature?: string;
};

function createPool(config: DatabaseConfig) {
  return mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: 5,
    connectTimeout: config.connectTimeoutMs,
    waitForConnections: true,
  });
}

function getConfigSignature(config: DatabaseConfig) {
  return [
    config.host,
    config.port,
    config.user,
    config.database,
    config.connectTimeoutMs,
  ].join("|");
}

export function getDb(): Database {
  const config = getDatabaseConfig();
  const configSignature = getConfigSignature(config);

  if (globalForDb.mysqlPool && globalForDb.dbConfigSignature !== configSignature) {
    void globalForDb.mysqlPool.end();
    globalForDb.mysqlPool = undefined;
    globalForDb.db = undefined;
  }

  if (!globalForDb.mysqlPool) {
    globalForDb.mysqlPool = createPool(config);
    globalForDb.dbConfigSignature = configSignature;
  }

  if (!globalForDb.db) {
    globalForDb.db = drizzle(globalForDb.mysqlPool, { schema, mode: "default" });
  }

  return globalForDb.db;
}
