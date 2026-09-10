import "dotenv/config";
import dotenv from "dotenv";
import type { Knex } from "knex";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Explicit path: the knex CLI changes cwd to this directory,
// so a bare dotenv/config would look for .env in the wrong place.
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

function sqliteConfig(ext: string): Knex.Config {
  const dbPath =
    process.env.BUDDY_DB_PATH ?? process.env.RAFIQ_DB_PATH ?? path.join(__dirname, "..", "..", "buddy.db");
  return {
    client: "better-sqlite3",
    connection: { filename: dbPath },
    useNullAsDefault: true,
    migrations: { directory: path.join(__dirname, "migrations"), extension: ext },
  };
}

function pgConfig(ext: string): Knex.Config {
  return {
    client: "pg",
    connection: process.env.DATABASE_URL,
    migrations: { directory: path.join(__dirname, "migrations"), extension: ext },
  };
}

const useSqlite = process.env.DB_CLIENT === "sqlite";

const config: { [key: string]: Knex.Config } = {
  development: useSqlite ? sqliteConfig("ts") : pgConfig("ts"),
  production: useSqlite ? sqliteConfig("js") : pgConfig("js"),
};

export default config;
