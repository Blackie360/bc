import "server-only";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/db/schema";

type Database = MySql2Database<typeof schema>;

let db: Database | null = null;

function databaseUrl() {
  const url = process.env.DATABASE_URL ?? process.env.MYSQL_URL;

  if (!url) {
    throw new Error("DATABASE_URL or MYSQL_URL is required to connect to MySQL.");
  }

  return url;
}

export function getDb() {
  if (!db) {
    db = drizzle({
      connection: {
        uri: databaseUrl(),
      },
      schema,
      mode: "default",
    });
  }

  return db;
}

export { schema };
