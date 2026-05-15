import { defineConfig } from "drizzle-kit";
import { getDatabaseConfig } from "./lib/db-config";

const config = getDatabaseConfig();

export default defineConfig({
  dialect: "mysql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  },
  strict: true,
  verbose: true,
});
