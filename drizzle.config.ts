import { defineConfig } from "drizzle-kit";

// Build connection string based on environment
function buildDatabaseUrl(): string {
  // Check if RDS configuration exists (production/staging)
  const rdsHost = process.env.RDS_HOST;
  const rdsPort = process.env.RDS_PORT || '3306';
  const rdsDatabase = process.env.RDS_DATABASE;
  const rdsUsername = process.env.RDS_USERNAME;
  const rdsPassword = process.env.RDS_PASSWORD;

  if (rdsHost && rdsDatabase && rdsUsername && rdsPassword) {
    return `mysql://${rdsUsername}:${rdsPassword}@${rdsHost}:${rdsPort}/${rdsDatabase}`;
  }

  // Fall back to DATABASE_URL for local development
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  throw new Error(
    "No database configuration found. Please set either:\n" +
    "- RDS_HOST, RDS_DATABASE, RDS_USERNAME, RDS_PASSWORD (for production)\n" +
    "- DATABASE_URL (for local development)"
  );
}

export default defineConfig({
  out: "./drizzle",
  schema: "./shared/schema.ts",
  dialect: "mysql",
  dbCredentials: {
    url: buildDatabaseUrl(),
  },
});
