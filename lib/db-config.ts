import "dotenv/config";

export type DatabaseConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required to initialize the database.`);
  }

  return value;
}

export function getDatabaseConfig(): DatabaseConfig {
  return {
    host: requiredEnv("DB_URL"),
    user: requiredEnv("DB_USER"),
    password: requiredEnv("DB_PASSWORD"),
    database: requiredEnv("DB_NAME"),
    port: Number(process.env.DB_PORT ?? 3306),
  };
}
