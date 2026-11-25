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

  it("las funciones SECURITY DEFINER fijan search_path vacío", async () => {
    const { rows } = await sql<{ name: string }>(`
      select n.nspname || '.' || p.proname as name
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private')
        and p.prosecdef
        and not exists (
          select from unnest(coalesce(p.proconfig, '{}')) cfg where cfg in ('search_path=', 'search_path=""')
        )
      order by 1
    `);
    expect(rows.map((row) => row.name)).toEqual([]);
  });

  it("visitantes y usuarios no tienen ningún permiso sobre las secuencias", async () => {
    const { rows } = await sql<{ name: string }>(`
      select r.role || ' -> ' || c.relname as name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      cross join unnest(array['anon', 'authenticated']) as r(role)
      where n.nspname = 'public' and c.relkind = 'S'
        and (
          has_sequence_privilege(r.role, c.oid, 'USAGE')
          or has_sequence_privilege(r.role, c.oid, 'SELECT')
          or has_sequence_privilege(r.role, c.oid, 'UPDATE')
        )
      order by 1
    `);
    expect(rows.map((row) => row.name)).toEqual([]);
  });

  it("toda vista de public respeta el RLS de quien consulta (security_invoker)", async () => {
    const { rows } = await sql<{ name: string }>(`
      select c.relname as name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('v', 'm')
        and not coalesce(c.reloptions, '{}') @> array['security_invoker=true']
      order by 1
    `);
    expect(rows.map((row) => row.name)).toEqual([]);
  });

  it("una tabla nueva nace cerrada para visitantes y usuarios", async () => {
    const { rows } = await sql<{ defaclobjtype: string; grantee: string }>(`
      select d.defaclobjtype, a.grantee::regrole::text as grantee
      from pg_default_acl d
      join pg_namespace n on n.oid = d.defaclnamespace
      cross join lateral aclexplode(d.defaclacl) a
      where n.nspname = 'public' and a.grantee::regrole::text in ('anon', 'authenticated')
    `);
    expect(rows).toEqual([]);
  });

  it("los permisos de tabla completa de un usuario con sesión son exactamente estos", async () => {
    // Todo lo demás se concede por columna. Si esta lista cambia, que sea a propósito.
    const { rows } = await sql<{ grant: string }>(`
      select table_name || ':' || privilege_type as grant
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'authenticated'
      order by 1
    `);
    // Escritura de tabla completa: solo en catálogo y reglas de precio, y las políticas la
    // limitan a admin. Lectura de tabla completa: datos públicos o protegidos por RLS.
    const catalogTables = [
      "finish_levels",
      "homes",
      "house_models",
      "lots",
      "quote_extras",
      "region_price_factors",
      "stage_templates",
    ];
    const expected = [
      "app_settings:DELETE",
      "audit_log:SELECT",
      "departments:SELECT",
      "funnel_events:SELECT",
      "leads:SELECT",
      "municipalities:SELECT",
      "quote_items:SELECT",
      ...catalogTables.flatMap((table) =>
        ["DELETE", "INSERT", "SELECT", "UPDATE"].map((p) => `${table}:${p}`),
      ),
    ].sort();
    expect(rows.map((row) => row.grant)).toEqual(expected);
  });

  it("ninguna función expuesta por la API la puede ejecutar un visitante o un usuario", async () => {
    const { rows } = await sql<{ name: string }>(`
      select r.role || ' -> ' || p.proname as name
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join unnest(array['anon', 'authenticated']) as r(role)
      where n.nspname = 'public'
        and has_function_privilege(r.role, p.oid, 'execute')
      order by 1
    `);
    // Hoy no hay ninguna función que deba llamarse desde fuera del servidor.
    expect(rows.map((row) => row.name)).toEqual([]);
  });

  it("del esquema private, visitantes y usuarios solo ejecutan las funciones de permisos", async () => {
    const { rows } = await sql<{ name: string }>(`
      select distinct p.proname as name
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join unnest(array['anon', 'authenticated']) as r(role)
      where n.nspname = 'private'
        and has_function_privilege(r.role, p.oid, 'execute')
      order by 1
    `);
    expect(rows.map((row) => row.name)).toEqual([
      "current_user_role",
      "has_role",
      "is_admin",
      "is_staff",
      // La usa un CHECK de homes; es pura y no lee datos.
      "is_valid_home_feature_list",
      "user_is_staff",
    ]);
  });

  it("toda llave foránea tiene un índice que empieza por sus columnas", async () => {
    const { rows } = await sql<{ fk: string }>(`
      select c.conrelid::regclass::text || ' (' || string_agg(a.attname, ', ' order by k.ord) || ')' as fk
      from pg_constraint c
      join pg_namespace n on n.oid = c.connamespace
      cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
      where c.contype = 'f' and n.nspname = 'public'
        and not exists (
          select 1 from pg_index i
          where i.indrelid = c.conrelid
            and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
            and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey
        )
      group by c.oid, c.conrelid
      order by 1
    `);
    expect(rows.map((row) => row.fk)).toEqual([]);
  });
});
