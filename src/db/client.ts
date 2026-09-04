import "dotenv/config";
import knex, { type Knex } from "knex";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function buildConfig(): Knex.Config {
  if (process.env.DB_CLIENT === "sqlite") {
    const dbPath =
      process.env.RAFIQ_DB_PATH ?? path.join(__dirname, "..", "..", "rafiq.db");
    return {
      client: "better-sqlite3",
      connection: { filename: dbPath },
      useNullAsDefault: true,
      migrations: { directory: path.join(__dirname, "migrations") },
    };
  }
  return {
    client: "pg",
    connection: process.env.DATABASE_URL,
    migrations: { directory: path.join(__dirname, "migrations") },
  };
}

let db: Knex | null = null;

export function getDb(): Knex {
  if (!db) {
    db = knex(buildConfig());
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
  }
}
