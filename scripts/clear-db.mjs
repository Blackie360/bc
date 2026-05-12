/**
 * Truncates all application tables. Schema, enums, and Drizzle migration history are kept.
 * Usage: pnpm run db:clear
 */
import "dotenv/config";
import pg from "pg";

const truncateSql = `
TRUNCATE TABLE
  "AuditLog",
  "ActualCostCapture",
  "ApprovalCertificate",
  "ApprovalHistory",
  "Revision",
  "BusinessCaseLink",
  "Document",
  "WorkflowAssignment",
  "PboqRequest",
  "BusinessCase",
  "Opportunity",
  "User"
RESTART IDENTITY CASCADE;
`;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(truncateSql);
    console.log("Application tables truncated successfully.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
