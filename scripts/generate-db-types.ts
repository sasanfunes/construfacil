/**
 * Genera `src/lib/supabase/database.types.ts` desde las migraciones, en el formato de
 * `supabase gen types`. Crea la base de pruebas desde cero (necesita TEST_DATABASE_URL)
 * y lee su esquema. Cuando exista el proyecto en Supabase se puede usar el generador
 * oficial; este existe para no mantener los tipos a mano mientras tanto.
 *
 *   pnpm db:types          escribe el archivo
 *   pnpm db:types --check  falla si no está al día (lo usa CI)
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import pg from "pg";
import * as prettier from "prettier";

import { resetTestDatabase, testDbUrl } from "../supabase/tests/db";

/** Firmas de las funciones de `public` que se llaman por RPC. Si se agrega una, va aquí. */
const FUNCTIONS: Record<string, { Args: string; Returns: string }> = {
  check_rate_limit: {
    Args: "{ p_bucket: string; p_limit: number; p_window_seconds: number }",
    Returns: "{ allowed: boolean; remaining: number; reset_at: string }[]",
  },
  submit_lead: { Args: "{ p_lead: Json; p_video_call?: Json | null }", Returns: "string" },
  submit_quote: {
    Args: "{ p_lead: Json; p_quote: Json; p_items: Json; p_video_call?: Json | null }",
    Returns: "{ quote_id: string; quote_code: string }[]",
  },
};

type Column = {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
  is_identity: "YES" | "NO";
  identity_generation: "ALWAYS" | "BY DEFAULT" | null;
};

const SCALARS: Record<string, string> = {
  uuid: "string",
  text: "string",
  varchar: "string",
  bpchar: "string",
  date: "string",
  time: "string",
  timestamp: "string",
  timestamptz: "string",
  inet: "string",
  int2: "number",
  int4: "number",
  int8: "number",
  float4: "number",
  float8: "number",
  numeric: "number",
  bool: "boolean",
  json: "Json",
  jsonb: "Json",
};

function tsType(column: Pick<Column, "data_type" | "udt_name">, enums: Set<string>): string {
  const { udt_name: udt } = column;
  if (udt.startsWith("_")) return `${tsType({ data_type: "", udt_name: udt.slice(1) }, enums)}[]`;
  if (enums.has(udt)) return `Database["public"]["Enums"]["${udt}"]`;
  const scalar = SCALARS[udt];
  if (!scalar) throw new Error(`Tipo de Postgres sin mapear: ${udt}`);
  return scalar;
}

async function main() {
  const check = process.argv.includes("--check");
  await resetTestDatabase();
  const db = new pg.Client({ connectionString: testDbUrl() });
  await db.connect();

  try {
    const enumRows = (
      await db.query<{ typname: string; label: string }>(`
        select t.typname, e.enumlabel as label
        from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' order by t.typname, e.enumsortorder`)
    ).rows;
    const enums = new Map<string, string[]>();
    for (const row of enumRows) enums.set(row.typname, [...(enums.get(row.typname) ?? []), row.label]);

    const columns = (
      await db.query<Column>(`
        select c.table_name, c.column_name, c.data_type, c.udt_name, c.is_nullable, c.column_default,
               c.is_identity, c.identity_generation
        from information_schema.columns c
        join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
        where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
        order by c.table_name, c.ordinal_position`)
    ).rows;

    const functions = (
      await db.query<{ proname: string }>(`
        select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prokind = 'f' order by 1`)
    ).rows.map((r) => r.proname);
    const known = Object.keys(FUNCTIONS).sort();
    if (JSON.stringify(functions) !== JSON.stringify(known)) {
      throw new Error(
        `Las funciones de public cambiaron (${functions.join(", ")}). Actualiza FUNCTIONS en scripts/generate-db-types.ts.`,
      );
    }

    const enumNames = new Set(enums.keys());
    const tables = new Map<string, Column[]>();
    for (const column of columns)
      tables.set(column.table_name, [...(tables.get(column.table_name) ?? []), column]);

    const tableTypes = [...tables.entries()]
      .map(([table, cols]) => {
        const row = cols.map(
          (c) => `${c.column_name}: ${tsType(c, enumNames)}${c.is_nullable === "YES" ? " | null" : ""}`,
        );
        const insert = cols.map((c) => {
          if (c.identity_generation === "ALWAYS") return `${c.column_name}?: never`;
          const optional = c.is_nullable === "YES" || c.column_default !== null || c.is_identity === "YES";
          return `${c.column_name}${optional ? "?" : ""}: ${tsType(c, enumNames)}${c.is_nullable === "YES" ? " | null" : ""}`;
        });
        const update = cols.map((c) =>
          c.identity_generation === "ALWAYS"
            ? `${c.column_name}?: never`
            : `${c.column_name}?: ${tsType(c, enumNames)}${c.is_nullable === "YES" ? " | null" : ""}`,
        );
        return `${table}: {
          Row: { ${row.join("; ")} };
          Insert: { ${insert.join("; ")} };
          Update: { ${update.join("; ")} };
          Relationships: [];
        };`;
      })
      .join("\n");

    const enumTypes = [...enums.entries()]
      .map(([name, labels]) => `${name}: ${labels.map((l) => JSON.stringify(l)).join(" | ")};`)
      .join("\n");

    const functionTypes = Object.entries(FUNCTIONS)
      .map(([name, sig]) => `${name}: { Args: ${sig.Args}; Returns: ${sig.Returns} };`)
      .join("\n");

    const source = `/**
 * Tipos de la base de datos. ARCHIVO GENERADO por \`pnpm db:types\` desde las migraciones.
 * No editar a mano. Cuando exista el proyecto de Supabase también se puede usar:
 *   pnpm dlx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      ${tableTypes}
    };
    Views: Record<never, never>;
    Functions: {
      ${functionTypes}
    };
    Enums: {
      ${enumTypes}
    };
    CompositeTypes: Record<never, never>;
  };
};

export type Tables<Name extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][Name]["Row"];
export type TablesInsert<Name extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][Name]["Insert"];
export type Enums<Name extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][Name];
`;

    const target = path.resolve(import.meta.dirname, "../src/lib/supabase/database.types.ts");
    const config = await prettier.resolveConfig(target);
    const formatted = await prettier.format(source, { ...config, filepath: target, plugins: [] });

    if (check) {
      if (readFileSync(target, "utf8") !== formatted) {
        console.error("database.types.ts no está al día. Corre `pnpm db:types` y vuelve a hacer commit.");
        process.exitCode = 1;
      } else {
        console.log("database.types.ts está al día.");
      }
    } else {
      writeFileSync(target, formatted);
      console.log(`Escrito ${path.relative(process.cwd(), target)}`);
    }
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
