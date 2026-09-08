// Applies db/schema.sql against the configured database. Safe to re-run.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = process.env.SCHEMA_PATH || path.resolve(here, "../../db/schema.sql");

const sql = await readFile(schemaPath, "utf8");
await pool.query(sql);
console.log(`Applied schema from ${schemaPath}`);
await pool.end();
