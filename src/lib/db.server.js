import { Pool } from "pg";

let pool;

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL n'est pas configurée sur le serveur.");
  }
  if (!pool) {
    const connectionUrl = new URL(process.env.DATABASE_URL);
    const sslMode = connectionUrl.searchParams.get("sslmode");
    if (["prefer", "require", "verify-ca"].includes(sslMode)) {
      connectionUrl.searchParams.set("sslmode", "verify-full");
    }
    pool = new Pool({
      connectionString: connectionUrl.toString(),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: true },
    });
  }
  return pool;
}
