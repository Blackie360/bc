/**
 * Applies the Drizzle MySQL schema without interactive drizzle-kit prompts.
 * Usage: pnpm run db:setup
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import mysql from "mysql2/promise";

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not set.`);
  }

  return value;
}

function getDatabaseConfig() {
  return {
    host: requiredEnv("DB_URL"),
    user: requiredEnv("DB_USER"),
    password: requiredEnv("DB_PASSWORD"),
    database: requiredEnv("DB_NAME"),
    port: Number(process.env.DB_PORT ?? 3306),
  };
}

const tables = [
  "AuditLog",
  "ActualCostCapture",
  "ApprovalCertificate",
  "ApprovalHistory",
  "Revision",
  "BusinessCaseLink",
  "Document",
  "WorkflowAssignment",
  "PboqCostLine",
  "PboqRequest",
  "BusinessCase",
  "Opportunity",
  "User",
];

async function resetTables(connection) {
  await connection.query("SET FOREIGN_KEY_CHECKS = 0");

  for (const table of tables) {
    await connection.query(`DROP TABLE IF EXISTS \`${table}\``);
  }

  await connection.query("SET FOREIGN_KEY_CHECKS = 1");
}

async function main() {
  const config = getDatabaseConfig();
  const connection = await mysql.createConnection(config);

  try {
    await resetTables(connection);
    console.log("Dropped existing application tables.");
  } finally {
    await connection.end();
  }

  execSync("pnpm exec drizzle-kit push --force", {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: "inherit",
  });

  console.log("MySQL schema applied.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
