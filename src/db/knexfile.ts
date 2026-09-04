import type { Knex } from "knex";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath =
  process.env.RAFIQ_DB_PATH ?? path.join(__dirname, "..", "..", "rafiq.db");

const config: { [key: string]: Knex.Config } = {
  development: {
    client: "better-sqlite3",
    connection: { filename: dbPath },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, "migrations"),
      extension: "ts",
    },
  },
  production: {
    client: "better-sqlite3",
    connection: { filename: dbPath },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, "migrations"),
      extension: "js",
    },
  },
};

export default config;
