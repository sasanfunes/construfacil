import { beforeAll, describe, expect, it } from "vitest";

import { anon, as, createUser, DENIED, errorCode, rowCount, sql, user } from "./helpers";

describe("datos de referencia", () => {
  let cliente: string;
  let ventas: string;
  let admin: string;

  beforeAll(async () => {
    cliente = await createUser("cliente");
    ventas = await createUser("ventas");
    admin = await createUser("admin");
  });

  describe("departamentos y municipios", () => {
    it("están los 18 departamentos y los cuatro del lanzamiento salen activos", async () => {
      const all = await as(anon, (db) => db.query("select name from public.departments"));
      expect(all.rowCount).toBe(18);

      const active = await as(anon, (db) =>
        db.query<{ name: string }>("select name from public.departments where is_active order by name"),
      );
      expect(active.rows.map((row) => row.name)).toEqual([
        "Atlántida",
        "Comayagua",
        "Cortés",
        "Francisco Morazán",
      ]);
    });

    it("cada departamento activo tiene municipios", async () => {
      const { rows } = await as(anon, (db) =>
        db.query<{ name: string; total: string }>(`
          select d.name, count(m.id) as total
          from public.departments d left join public.municipalities m on m.department_id = d.id
          where d.is_active group by d.name order by d.name
        `),
      );
      for (const row of rows) expect(Number(row.total), row.name).toBeGreaterThanOrEqual(8);
    });

    it("visitantes y clientes leen pero no modifican", async () => {
      expect(await errorCode(anon, "update public.departments set is_active = true")).toBe(DENIED);
      expect(
        await rowCount(user(cliente), "update public.departments set is_active = true where id = 2"),
      ).toBe(0);
      expect(
        await errorCode(
          user(cliente),
          "insert into public.municipalities (department_id, name) values (5, 'Falso')",
        ),
      ).toBe(DENIED);
      expect(await errorCode(user(cliente), "delete from public.municipalities")).toBe(DENIED);
    });

    it("admin activa un departamento y agrega municipios, pero no cambia códigos oficiales", async () => {
      expect(
        await rowCount(user(admin), "update public.departments set is_active = true where id = 18"),
      ).toBe(1);
      expect(
        await rowCount(
          user(admin),
          "insert into public.municipalities (department_id, name) values (18, 'El Progreso')",
        ),
      ).toBe(1);
      expect(
        await errorCode(user(admin), "update public.departments set iso_code = 'HN-XX' where id = 18"),
      ).toBe(DENIED);
      expect(await errorCode(user(admin), "delete from public.departments where id = 18")).toBe(DENIED);
    });
  });

  describe("tipo de cambio", () => {
    it("cualquiera puede leerlo", async () => {
      expect(await rowCount(anon, "select 1 from public.exchange_rates")).toBeGreaterThan(0);
    });

    it("solo admin agrega una tasa, a su nombre, y queda en la bitácora", async () => {
      const insert =
        "insert into public.exchange_rates (usd_to_hnl, effective_date, source, created_by) values (26.75, $1, 'BCH', $2)";
      expect(await errorCode(user(cliente), insert, ["2026-12-01", cliente])).toBe(DENIED);
      expect(await errorCode(user(ventas), insert, ["2026-12-01", ventas])).toBe(DENIED);
      // Un admin no puede registrar la tasa a nombre de otra persona.
      expect(await errorCode(user(admin), insert, ["2026-12-01", cliente])).toBe(DENIED);

      expect(await rowCount(user(admin), insert, ["2026-12-01", admin], true)).toBe(1);

      const audit = await sql(
        "select actor_id, action, after_data ->> 'usd_to_hnl' as rate from public.audit_log where entity_type = 'exchange_rates' order by id desc limit 1",
      );
      expect(audit.rows[0]).toEqual({ actor_id: admin, action: "insert", rate: "26.7500" });
    });

    it("el historial no se edita ni se borra, ni siendo admin", async () => {
      expect(await errorCode(user(admin), "update public.exchange_rates set usd_to_hnl = 1.5")).toBe(DENIED);
      expect(await errorCode(user(admin), "delete from public.exchange_rates")).toBe(DENIED);
    });

    it("rechaza tasas absurdas", async () => {
      expect(
        await errorCode(
          user(admin),
          "insert into public.exchange_rates (usd_to_hnl, effective_date, source, created_by) values (0, '2027-01-01', 'x', $1)",
          [admin],
        ),
      ).toBe("23514");
    });
  });

  describe("ajustes", () => {
    const privateKey = "sales.lead_notification_note";

    it("visitantes y clientes solo ven los ajustes públicos", async () => {
      for (const actor of [anon, user(cliente)]) {
        const { rows } = await as(actor, (db) =>
          db.query<{ is_public: boolean }>("select is_public from public.app_settings"),
        );
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((row) => row.is_public)).toBe(true);
        expect(await rowCount(actor, "select 1 from public.app_settings where key = $1", [privateKey])).toBe(
          0,
        );
      }
    });

    it("el equipo ve también los privados", async () => {
      expect(
        await rowCount(user(ventas), "select 1 from public.app_settings where key = $1", [privateKey]),
      ).toBe(1);
    });

    it("solo admin los cambia, y el cambio queda en la bitácora", async () => {
      const update =
        "update public.app_settings set value = '25'::jsonb where key = 'payments.initial_payment_percent'";
      expect(await errorCode(anon, update)).toBe(DENIED);
      expect(await rowCount(user(cliente), update, [], true)).toBe(0);
      expect(await rowCount(user(ventas), update, [], true)).toBe(0);
      expect(await rowCount(user(admin), update, [], true)).toBe(1);

      const audit = await sql(
        "select actor_id, before_data ->> 'value' as before, after_data ->> 'value' as after from public.audit_log where entity_type = 'app_settings' and entity_id = 'payments.initial_payment_percent' order by id desc limit 1",
      );
      expect(audit.rows[0]).toEqual({ actor_id: admin, before: "20", after: "25" });
    });
  });
});
