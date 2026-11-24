import { beforeAll, describe, expect, it } from "vitest";

import { anon, as, createUser, DENIED, errorCode, rowCount, sql, user } from "./helpers";

describe("perfiles", () => {
  let ana: string;
  let beto: string;
  let ventas: string;
  let gerente: string;
  let logistica: string;
  let admin: string;

  beforeAll(async () => {
    ana = await createUser("cliente", { full_name: "Ana López", locale: "en" });
    beto = await createUser("cliente", { full_name: "Beto Mejía" });
    ventas = await createUser("ventas");
    gerente = await createUser("gerente_proyecto");
    logistica = await createUser("logistica");
    admin = await createUser("admin");
  });

  it("al registrarse se crea el perfil con rol cliente", async () => {
    const { rows } = await sql(
      "select p.full_name, p.preferred_locale, r.role from public.profiles p join public.user_roles r on r.user_id = p.id where p.id = $1",
      [ana],
    );
    expect(rows[0]).toEqual({ full_name: "Ana López", preferred_locale: "en", role: "cliente" });
  });

  it("el rol nunca se toma de los metadatos que envía quien se registra", async () => {
    const tramposo = await createUser("cliente", { role: "admin", user_role: "admin", is_admin: true });
    const { rows } = await sql("select role from public.user_roles where user_id = $1", [tramposo]);
    expect(rows[0]?.role).toBe("cliente");
  });

  it("un cliente solo ve su propio perfil", async () => {
    const rows = await as(user(ana), (db) => db.query("select id from public.profiles"));
    expect(rows.rows.map((row) => row.id)).toEqual([ana]);
    expect(await rowCount(user(ana), "select 1 from public.profiles where id = $1", [beto])).toBe(0);
  });

  it("un visitante sin sesión no puede leer perfiles", async () => {
    expect(await errorCode(anon, "select * from public.profiles")).toBe(DENIED);
  });

  it("un cliente edita sus datos, pero no los de otra persona", async () => {
    expect(
      await rowCount(user(ana), "update public.profiles set full_name = 'Ana L.' where id = $1", [ana]),
    ).toBe(1);
    expect(
      await rowCount(user(ana), "update public.profiles set full_name = 'Hackeado' where id = $1", [beto]),
    ).toBe(0);
  });

  it("un cliente no puede tocar su id de Stripe ni mover su perfil a otra cuenta", async () => {
    expect(
      await errorCode(
        user(ana),
        "update public.profiles set stripe_customer_id = 'cus_falso' where id = $1",
        [ana],
      ),
    ).toBe(DENIED);
    expect(await errorCode(user(ana), "update public.profiles set id = $2 where id = $1", [ana, beto])).toBe(
      DENIED,
    );
  });

  it("un cliente no puede crear ni borrar perfiles", async () => {
    expect(await errorCode(user(ana), "insert into public.profiles (id) values (gen_random_uuid())")).toBe(
      DENIED,
    );
    expect(await errorCode(user(ana), "delete from public.profiles where id = $1", [ana])).toBe(DENIED);
  });

  it("ventas y admin ven a todos los clientes", async () => {
    for (const staff of [ventas, admin]) {
      expect(
        await rowCount(user(staff), "select 1 from public.profiles where id = any($1)", [[ana, beto]]),
      ).toBe(2);
    }
  });

  it("gerente de proyecto y logística no ven perfiles ajenos", async () => {
    for (const staff of [gerente, logistica]) {
      expect(
        await rowCount(user(staff), "select 1 from public.profiles where id = any($1)", [[ana, beto]]),
      ).toBe(0);
    }
  });

  it("ni siquiera ventas puede editar el perfil de un cliente", async () => {
    expect(
      await rowCount(user(ventas), "update public.profiles set full_name = 'X' where id = $1", [ana]),
    ).toBe(0);
  });
});
