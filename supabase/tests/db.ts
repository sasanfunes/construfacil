import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import pg from "pg";

export const TEST_DB_NAME = "construfacil_rls_test";
const SUPABASE_DIR = path.resolve(import.meta.dirname, "..");

/** Conexión de administrador al servidor de Postgres de pruebas. */
export function adminUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta TEST_DATABASE_URL. Levanta un Postgres local con `pnpm db:test` o apunta a uno vacío. Ver README.",
    );
  }
  // Estos tests borran y recrean una base. Nunca deben correr contra un servidor real.
  const host = new URL(url).hostname;
  const isLocal = ["localhost", "127.0.0.1", "::1", "postgres"].includes(host);
  if (!isLocal && process.env.ALLOW_REMOTE_TEST_DB !== "1") {
    throw new Error(
      `TEST_DATABASE_URL apunta a "${host}". Los tests de RLS solo corren contra un Postgres local.`,
    );
  }
  return url;
}

export function testDbUrl(): string {
  const url = new URL(adminUrl());
  url.pathname = `/${TEST_DB_NAME}`;
  return url.toString();
}

function migrationFiles(): string[] {
  const dir = path.join(SUPABASE_DIR, "migrations");
  return readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => path.join(dir, file));
}

/** Crea la base de pruebas desde cero: shim de Supabase, migraciones y datos de ejemplo. */
export async function resetTestDatabase(): Promise<void> {
  const admin = new pg.Client({ connectionString: adminUrl() });
  await admin.connect();
  try {
    await admin.query(`drop database if exists ${TEST_DB_NAME} with (force)`);
    await admin.query(`create database ${TEST_DB_NAME}`);
  } finally {
    await admin.end();
  }

  const db = new pg.Client({ connectionString: testDbUrl() });
  await db.connect();
  try {
    const files = [
      path.join(SUPABASE_DIR, "tests", "supabase-shim.sql"),
      ...migrationFiles(),
      path.join(SUPABASE_DIR, "seed.sql"),
    ];
    for (const file of files) {
      try {
        await db.query(readFileSync(file, "utf8"));
      } catch (error) {
        throw new Error(`Falló ${path.relative(SUPABASE_DIR, file)}: ${(error as Error).message}`, {
          cause: error,
        });
      }
    }
  } finally {
    await db.end();
  }
}
