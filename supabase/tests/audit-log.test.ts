import { beforeAll, describe, expect, it } from "vitest";

import { anon, as, createUser, DENIED, errorCode, rowCount, service, sql, user } from "./helpers";

describe("bitácora de auditoría", () => {
  let cliente: string;
  let ventas: string;
  let admin: string;

  beforeAll(async () => {
    cliente = await createUser("cliente");
    ventas = await createUser("ventas");
    admin = await createUser("admin");
    await as(
      service,
      (db) =>
        db.query(
          "insert into public.audit_log (actor_id, action, entity_type, entity_id) values ($1, 'test.event', 'test', '1')",
          [admin],
        ),
      { commit: true },
    );
  });

  it("solo admin puede leerla", async () => {
    expect(
      await rowCount(user(admin), "select 1 from public.audit_log where action = 'test.event'"),
    ).toBeGreaterThan(0);
    expect(await rowCount(user(cliente), "select 1 from public.audit_log")).toBe(0);
    expect(await rowCount(user(ventas), "select 1 from public.audit_log")).toBe(0);
    expect(await errorCode(anon, "select * from public.audit_log")).toBe(DENIED);
  });

  it("nadie con sesión puede insertar, editar ni borrar", async () => {
    for (const actor of [cliente, admin]) {
      expect(
        await errorCode(
          user(actor),
          "insert into public.audit_log (action, entity_type) values ('falso', 'x')",
        ),
      ).toBe(DENIED);
      expect(await errorCode(user(actor), "update public.audit_log set action = 'editado'")).toBe(DENIED);
      expect(await errorCode(user(actor), "delete from public.audit_log")).toBe(DENIED);
    }
  });

  it("el servidor no puede elegir la fecha ni el id de un registro (no puede antedatar)", async () => {
    expect(
      await errorCode(
        service,
        "insert into public.audit_log (action, entity_type, occurred_at) values ('x', 'y', '2020-01-01')",
      ),
    ).toBe(DENIED);
    expect(
      await errorCode(
        service,
        "insert into public.audit_log (id, action, entity_type) overriding system value values (1, 'x', 'y')",
      ),
    ).toBe(DENIED);
  });

  it("los permisos de editar, borrar y vaciar están revocados, además del trigger", async () => {
    const { rows } = await sql<{ role: string; privilege: string }>(`
      select r.role, p.privilege
      from unnest(array['anon', 'authenticated', 'service_role']) as r(role),
           unnest(array['UPDATE', 'DELETE', 'TRUNCATE']) as p(privilege)
      where has_table_privilege(r.role, 'public.audit_log', p.privilege)
    `);
    expect(rows).toEqual([]);
  });

  it("el servidor puede insertar pero no editar, borrar ni vaciar", async () => {
    expect(await errorCode(service, "update public.audit_log set action = 'editado'")).toBe(DENIED);
    expect(await errorCode(service, "delete from public.audit_log")).toBe(DENIED);
    expect(await errorCode(service, "truncate public.audit_log")).toBe(DENIED);
  });

  // Un superusuario siempre puede desactivar triggers a propósito; contra eso la defensa es
  // enviar la bitácora a un destino externo (pendiente de la Fase 4). Esto cubre el accidente.
  it("un trigger impide editar o borrar incluso al dueño de la tabla", async () => {
    await expect(sql("update public.audit_log set action = 'editado'")).rejects.toMatchObject({
      code: DENIED,
    });
    await expect(sql("delete from public.audit_log")).rejects.toMatchObject({ code: DENIED });
    await expect(sql("truncate public.audit_log")).rejects.toMatchObject({ code: DENIED });
  });
});
