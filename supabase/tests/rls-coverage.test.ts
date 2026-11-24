import { describe, expect, it } from "vitest";

import { sql } from "./helpers";

/**
 * Red de seguridad: si alguien agrega una tabla o función y olvida protegerla,
 * estos tests fallan aunque nadie haya escrito un test específico para ella.
 */
describe("cobertura de seguridad de la base", () => {
  it("todas las tablas de public tienen RLS activado", async () => {
    const { rows } = await sql<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' and not rowsecurity order by tablename",
    );
    expect(rows.map((row) => row.tablename)).toEqual([]);
  });

  it("solo las tablas de esta lista pueden existir sin políticas (cerradas a la API)", async () => {
    const { rows } = await sql<{ tablename: string }>(`
      select t.tablename
      from pg_tables t
      where t.schemaname = 'public'
        and not exists (
          select from pg_policies p where p.schemaname = t.schemaname and p.tablename = t.tablename
        )
      order by t.tablename
    `);
    // rate_limits se usa solo a través de check_rate_limit().
    expect(rows.map((row) => row.tablename)).toEqual(["rate_limits"]);
  });

  it("un visitante sin sesión no puede escribir en ninguna tabla", async () => {
    const { rows } = await sql<{ table_name: string; privilege_type: string }>(`
      select table_name, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'anon' and privilege_type <> 'SELECT'
      union
      select table_name, privilege_type
      from information_schema.column_privileges
      where table_schema = 'public' and grantee = 'anon' and privilege_type <> 'SELECT'
      order by 1, 2
    `);
    expect(rows).toEqual([]);
  });

  it("las funciones SECURITY DEFINER fijan search_path", async () => {
    const { rows } = await sql<{ name: string }>(`
      select n.nspname || '.' || p.proname as name
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private')
        and p.prosecdef
        and not exists (select from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')
      order by 1
    `);
    expect(rows.map((row) => row.name)).toEqual([]);
  });

  it("ninguna función de private o public la puede ejecutar PUBLIC salvo las de solo lectura de permisos", async () => {
    const { rows } = await sql<{ name: string }>(`
      select n.nspname || '.' || p.proname as name
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and has_function_privilege('anon', p.oid, 'execute')
      order by 1
    `);
    // Hoy no hay ninguna función pública que un visitante deba poder llamar.
    expect(rows.map((row) => row.name)).toEqual([]);
  });
});
