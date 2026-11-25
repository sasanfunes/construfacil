import { beforeAll, describe, expect, it } from "vitest";

import { anon, as, createUser, DENIED, errorCode, rowCount, sql, user } from "./helpers";

const COPAN = "c3000000-0000-4000-8000-000000000002";
const CHOLOMA_HOME = "a1000000-0000-4000-8000-000000000001";

/** Inserta una casa como superusuario y devuelve su id. */
async function insertHome(listingStatus: string, slug: string) {
  const { rows } = await sql<{ id: string }>(
    `insert into public.homes (slug, code, title_es, title_en, summary_es, summary_en, description_es, description_en,
       department_id, municipality_id, construction_status, listing_status, price_usd_cents, bedrooms, bathrooms,
       construction_area_m2, lot_area_m2)
     values ($1, $2, 'Casa de prueba', 'Test home', 'Resumen de prueba', 'Test summary', 'Descripción de prueba',
       'Test description', 5, 1, 'ready', $3, 5000000, 3, 2, 90, 150)
     returning id`,
    [slug, `CF-C-${Math.floor(1000 + Math.random() * 8999)}`, listingStatus],
  );
  return rows[0]!.id;
}

describe("catálogo", () => {
  let cliente: string;
  let ventas: string;
  let gerente: string;
  let admin: string;
  let draftHome: string;
  let soldHome: string;

  beforeAll(async () => {
    cliente = await createUser("cliente");
    ventas = await createUser("ventas");
    gerente = await createUser("gerente_proyecto");
    admin = await createUser("admin");
    draftHome = await insertHome("draft", "casa-borrador-prueba");
    soldHome = await insertHome("sold", "casa-vendida-prueba");
  });

  describe("lectura", () => {
    it("un visitante ve las casas y terrenos publicados o apartados, nada más", async () => {
      const homes = await as(anon, (db) =>
        db.query<{ listing_status: string }>("select listing_status from public.homes"),
      );
      expect(homes.rowCount).toBe(12);
      expect(new Set(homes.rows.map((r) => r.listing_status))).toEqual(new Set(["published", "reserved"]));
      expect(await rowCount(anon, "select 1 from public.lots")).toBe(10);
    });

    it("borradores y vendidas solo los ve ventas o admin", async () => {
      const hidden = [draftHome, soldHome];
      for (const actor of [anon, user(cliente), user(gerente)]) {
        expect(await rowCount(actor, "select 1 from public.homes where id = any($1)", [hidden])).toBe(0);
      }
      for (const staff of [ventas, admin]) {
        expect(await rowCount(user(staff), "select 1 from public.homes where id = any($1)", [hidden])).toBe(
          2,
        );
      }
    });

    it("las reglas de precio activas son públicas; las inactivas no", async () => {
      expect(await rowCount(anon, "select 1 from public.stage_templates")).toBe(7);
      expect(await rowCount(anon, "select 1 from public.finish_levels")).toBe(3);
      expect(await rowCount(anon, "select 1 from public.region_price_factors")).toBe(4);
      expect(await rowCount(anon, "select 1 from public.quote_extras")).toBe(8);
      expect(await rowCount(anon, "select 1 from public.house_models")).toBe(5);

      await sql("update public.house_models set is_active = false where id = $1", [COPAN]);
      try {
        expect(await rowCount(anon, "select 1 from public.house_models where id = $1", [COPAN])).toBe(0);
        expect(await rowCount(user(ventas), "select 1 from public.house_models where id = $1", [COPAN])).toBe(
          1,
        );
      } finally {
        await sql("update public.house_models set is_active = true where id = $1", [COPAN]);
      }
    });
  });

  describe("escritura", () => {
    it("nadie sin sesión ni sin ser admin modifica el catálogo", async () => {
      expect(await errorCode(anon, "update public.homes set price_usd_cents = 1")).toBe(DENIED);
      expect(await errorCode(anon, "delete from public.lots")).toBe(DENIED);
      for (const actor of [cliente, ventas, gerente]) {
        expect(await rowCount(user(actor), "update public.homes set price_usd_cents = 1")).toBe(0);
        expect(await rowCount(user(actor), "update public.house_models set base_price_usd_cents = 1")).toBe(
          0,
        );
        expect(await rowCount(user(actor), "update public.region_price_factors set factor = 0.5")).toBe(0);
        expect(await rowCount(user(actor), "delete from public.quote_extras")).toBe(0);
        expect(
          await errorCode(
            user(actor),
            "insert into public.finish_levels (key, name_es, name_en, description_es, description_en, price_multiplier, custom_price_per_m2_usd_cents) values ('lujo', 'Lujo', 'Luxury', 'x x', 'x x', 2, 90000)",
          ),
        ).toBe(DENIED);
      }
    });

    it("admin cambia un precio y el cambio queda en la bitácora con su nombre", async () => {
      expect(
        await rowCount(
          user(admin),
          "update public.homes set price_usd_cents = 4600000 where id = $1",
          [CHOLOMA_HOME],
          true,
        ),
      ).toBe(1);
      const audit = await sql(
        `select actor_id, actor_role, before_data ->> 'price_usd_cents' as before, after_data ->> 'price_usd_cents' as after
         from public.audit_log where entity_type = 'homes' and entity_id = $1 and action = 'update' order by id desc limit 1`,
        [CHOLOMA_HOME],
      );
      expect(audit.rows[0]).toEqual({
        actor_id: admin,
        actor_role: "admin",
        before: "4650000",
        after: "4600000",
      });
      await sql("update public.homes set price_usd_cents = 4650000 where id = $1", [CHOLOMA_HOME]);
    });

    it("los cambios en reglas del cotizador también se auditan", async () => {
      expect(
        await rowCount(
          user(admin),
          "update public.region_price_factors set factor = 1.05 where department_id = 8",
          [],
          true,
        ),
      ).toBe(1);
      const audit = await sql(
        `select actor_id, after_data ->> 'factor' as factor from public.audit_log
         where entity_type = 'region_price_factors' and entity_id = '8' order by id desc limit 1`,
      );
      expect(audit.rows[0]).toEqual({ actor_id: admin, factor: "1.050" });
      await sql("update public.region_price_factors set factor = 1.04 where department_id = 8");
    });

    it("rechaza datos inconsistentes, también al admin", async () => {
      // Municipio de otro departamento (San Pedro Sula es de Cortés, no de Atlántida).
      expect(
        await errorCode(user(admin), "update public.homes set department_id = 1 where id = $1", [
          CHOLOMA_HOME,
        ]),
      ).toBe("23503");
      // Característica desconocida.
      expect(
        await errorCode(user(admin), "update public.homes set features = array['helipuerto'] where id = $1", [
          CHOLOMA_HOME,
        ]),
      ).toBe("23514");
      // Medio baño sí, un tercio de baño no.
      expect(
        await errorCode(user(admin), "update public.homes set bathrooms = 2.3 where id = $1", [CHOLOMA_HOME]),
      ).toBe("23514");
      // Precio cero, slug con espacios, coordenadas fuera de Honduras.
      expect(await errorCode(user(admin), "update public.lots set price_usd_cents = 0")).toBe("23514");
      expect(
        await errorCode(user(admin), "update public.homes set slug = 'casa con espacios' where id = $1", [
          CHOLOMA_HOME,
        ]),
      ).toBe("23514");
      expect(
        await errorCode(user(admin), "update public.homes set latitude = 40.7 where id = $1", [CHOLOMA_HOME]),
      ).toBe("23514");
      // Un extra con cantidad por defecto fuera de su rango.
      expect(
        await errorCode(
          user(admin),
          "update public.quote_extras set default_quantity = 999 where key = 'air_conditioning'",
        ),
      ).toBe("23514");
    });

    it("un video o recorrido solo puede ser un enlace https", async () => {
      expect(
        await errorCode(
          user(admin),
          "update public.homes set video_url = 'javascript:alert(1)' where id = $1",
          [CHOLOMA_HOME],
        ),
      ).toBe("23514");
      expect(
        await errorCode(
          user(admin),
          "update public.homes set tour_url = 'http://inseguro.example' where id = $1",
          [CHOLOMA_HOME],
        ),
      ).toBe("23514");
    });
  });
});
