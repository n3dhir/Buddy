import dotenv from "dotenv";
import knex from "knex";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Explicit path: never depend on the caller's working directory.
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });
function buildConfig() {
    if (process.env.DB_CLIENT === "sqlite") {
        const dbPath = process.env.RAFIQ_DB_PATH ?? path.join(__dirname, "..", "..", "rafiq.db");
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
let db = null;
export function getDb() {
    if (!db) {
        db = knex(buildConfig());
    }
    return db;
}
export async function closeDb() {
    if (db) {
        await db.destroy();
        db = null;
    }
}
//# sourceMappingURL=client.js.map