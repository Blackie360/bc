/**
 * Truncates all application tables. Schema and Drizzle migration history are kept.
 * Usage: pnpm run db:clear
 */
import "dotenv/config";
import mysql from "mysql2/promise";

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

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    console.error(`${name} is not set.`);
    process.exit(1);
  }

  return value;
}

async function main() {
  const connection = await mysql.createConnection({
    host: requiredEnv("DB_URL"),
    user: requiredEnv("DB_USER"),
    password: requiredEnv("DB_PASSWORD"),
    database: requiredEnv("DB_NAME"),
    port: Number(process.env.DB_PORT ?? 3306),
  });

  try {
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of tables) {
      await connection.query(`TRUNCATE TABLE \`${table}\``);
    }
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("Application tables truncated successfully.");
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
