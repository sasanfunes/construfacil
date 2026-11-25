import pg from "pg";

import { testDbUrl } from "./db";

export type UserRole =
  "cliente" | "familiar_autorizado" | "ventas" | "gerente_proyecto" | "logistica" | "admin";

/** Quién hace la consulta: visitante sin sesión, una persona con sesión o el servidor. */
export type Actor = { kind: "anon" } | { kind: "user"; id: string } | { kind: "service" };

export const anon: Actor = { kind: "anon" };
export const service: Actor = { kind: "service" };
export const user = (id: string): Actor => ({ kind: "user", id });

export type Db = Pick<pg.PoolClient, "query">;

let pool: pg.Pool | undefined;

function getPool(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: testDbUrl(), max: 4 });
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

/** Consulta como superusuario: para preparar datos y verificar resultados sin RLS. */
export async function sql<Row extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  return getPool().query<Row>(text, params);
}

let userCounter = 0;

/** Crea una cuenta igual que lo haría Supabase Auth: inserta en auth.users y el trigger hace el resto. */
export async function createUser(
  role: UserRole = "cliente",
  metadata: Record<string, unknown> = {},
): Promise<string> {
  userCounter += 1;
  const email = `${role}-${Date.now()}-${userCounter}@example.test`;
  const { rows } = await sql<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify(metadata)],
  );
  const id = rows[0]!.id;
  if (role !== "cliente") {
    await sql("update public.user_roles set role = $1 where user_id = $2", [role, id]);
  }
  return id;
}

/**
 * Ejecuta `fn` con el rol y el JWT que tendría ese actor al entrar por la API de Supabase.
 * Corre dentro de una transacción. Por defecto se revierte al final para no dejar rastro;
 * con `commit: true` los cambios se guardan.
 */
export async function as<T>(
  actor: Actor,
  fn: (db: Db) => Promise<T>,
  options: { commit?: boolean } = {},
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const role = actor.kind === "anon" ? "anon" : actor.kind === "service" ? "service_role" : "authenticated";
    const claims = actor.kind === "user" ? { sub: actor.id, role } : { role };
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const result = await fn(client);
    await client.query(options.commit ? "commit" : "rollback");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Código de error de Postgres cuando falta permiso (GRANT) o una política de RLS rechaza la fila. */
export const DENIED = "42501";

/**
 * Corre una consulta que se espera que Postgres rechace y devuelve el código de error.
 * Devuelve `null` si la consulta NO fue rechazada.
 */
export async function errorCode(actor: Actor, text: string, params: unknown[] = []): Promise<string | null> {
  try {
    await as(actor, (db) => db.query(text, params));
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}

/** Número de filas que ve o afecta el actor. */
export async function rowCount(
  actor: Actor,
  text: string,
  params: unknown[] = [],
  commit = false,
): Promise<number> {
  const result = await as(actor, (db) => db.query(text, params), { commit });
  return result.rowCount ?? 0;
}
