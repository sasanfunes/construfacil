import { beforeAll, describe, expect, it } from "vitest";

import { anon, createUser, DENIED, errorCode, rowCount, sql, user } from "./helpers";

describe("roles", () => {
  let ana: string;
  let beto: string;
  let ventas: string;
  let admin: string;

  beforeAll(async () => {
    ana = await createUser("cliente");
    beto = await createUser("cliente");
    ventas = await createUser("ventas");
    admin = await createUser("admin");
  });

  const roleOf = async (id: string) =>
    (await sql<{ role: string }>("select role from public.user_roles where user_id = $1", [id])).rows[0]
      ?.role;

  it("cada quien ve solo su rol; admin ve todos", async () => {
    expect(await rowCount(user(ana), "select 1 from public.user_roles")).toBe(1);
    expect(await rowCount(user(ventas), "select 1 from public.user_roles")).toBe(1);
    expect(
      await rowCount(user(admin), "select 1 from public.user_roles where user_id = any($1)", [[ana, beto]]),
    ).toBe(2);
    expect(await errorCode(anon, "select * from public.user_roles")).toBe(DENIED);
  });

  it("un cliente no puede subirse de rol", async () => {
    expect(
      await rowCount(
        user(ana),
        "update public.user_roles set role = 'admin' where user_id = $1",
        [ana],
        true,
      ),
    ).toBe(0);
    expect(await roleOf(ana)).toBe("cliente");
  });

  it("ventas no puede cambiar roles, ni el suyo ni el de otros", async () => {
    expect(
      await rowCount(
        user(ventas),
        "update public.user_roles set role = 'admin' where user_id = $1",
        [ventas],
        true,
      ),
    ).toBe(0);
    expect(
      await rowCount(
        user(ventas),
        "update public.user_roles set role = 'ventas' where user_id = $1",
        [ana],
        true,
      ),
    ).toBe(0);
    expect(await roleOf(ventas)).toBe("ventas");
    expect(await roleOf(ana)).toBe("cliente");
  });

  it("nadie con sesión puede insertar o borrar filas de roles", async () => {
    for (const actor of [ana, admin]) {
      expect(
        await errorCode(user(actor), "insert into public.user_roles (user_id, role) values ($1, 'admin')", [
          actor,
        ]),
      ).toBe(DENIED);
      expect(await errorCode(user(actor), "delete from public.user_roles where user_id = $1", [beto])).toBe(
        DENIED,
      );
    }
  });

  it("un admin cambia el rol de otra persona y queda en la bitácora con su nombre", async () => {
    expect(
      await rowCount(
        user(admin),
        "update public.user_roles set role = 'gerente_proyecto' where user_id = $1",
        [beto],
        true,
      ),
    ).toBe(1);

    const assignment = await sql("select role, assigned_by from public.user_roles where user_id = $1", [
      beto,
    ]);
    expect(assignment.rows[0]).toEqual({ role: "gerente_proyecto", assigned_by: admin });

    const audit = await sql(
      `select actor_id, actor_role, action, before_data ->> 'role' as before_role, after_data ->> 'role' as after_role
       from public.audit_log
       where entity_type = 'user_roles' and entity_id = $1 and action = 'update'
       order by id desc limit 1`,
      [beto],
    );
    expect(audit.rows[0]).toEqual({
      actor_id: admin,
      actor_role: "admin",
      action: "update",
      before_role: "cliente",
      after_role: "gerente_proyecto",
    });
  });

  it("un admin no puede cambiar su propio rol", async () => {
    expect(
      await rowCount(
        user(admin),
        "update public.user_roles set role = 'cliente' where user_id = $1",
        [admin],
        true,
      ),
    ).toBe(0);
    expect(await roleOf(admin)).toBe("admin");
  });

  it("no se expone por la API quién asignó cada rol", async () => {
    for (const actor of [ana, admin]) {
      expect(await errorCode(user(actor), "select assigned_by from public.user_roles")).toBe(DENIED);
    }
  });

  it("un admin no puede falsificar quién asignó el rol", async () => {
    expect(
      await errorCode(user(admin), "update public.user_roles set assigned_by = $2 where user_id = $1", [
        beto,
        ana,
      ]),
    ).toBe(DENIED);
  });
});
