import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL ?? process.env.MYSQL_URL;

if (!databaseUrl) {
  throw new Error(
    "Set DATABASE_URL or MYSQL_URL before running Drizzle commands. Example: DATABASE_URL=\"mysql://user:password@localhost:3306/bc\"",
  );
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: databaseUrl,
  },
});
