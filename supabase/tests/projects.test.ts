import { createHash } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { anon, as, createUser, DENIED, errorCode, rowCount, service, sql, user } from "./helpers";

const COPAN = "c3000000-0000-4000-8000-000000000002";
const CHOLOMA_LOT = "b2000000-0000-4000-8000-000000000001";
const RESERVED_LOT = "b2000000-0000-4000-8000-000000000006";
// Opciones del catálogo de ejemplo (src/features/catalog/sample/construction.ts).
const option = (n: number) => `c7000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CATALOG_PLANS = option(3);
const BUILDING_PERMIT = option(4);
const REINFORCED_CONCRETE = option(5);
const CONCRETE_BLOCK = option(11);

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

const lead = (overrides: Record<string, unknown> = {}) => ({
  full_name: "María Hernández",
  email: "maria.hernandez@example.com",
  phone: "+13055550123",
  preferred_channel: "whatsapp",
  locale: "es",
  ...overrides,
});

const project = (overrides: Record<string, unknown> = {}) => ({
  access_token_hash: hash(crypto.randomUUID()),
  name: "Casa de mamá en Choloma",
  locale: "es",
  land_status: "own",
  department_id: 5,
  municipality_id: 2,
  land_area_m2: 300,
  design_source: "catalog",
  house_model_id: COPAN,
  area_m2: 86,
  floors: 1,
  bedrooms: 3,
  bathrooms: 2,
  preliminary_usd_cents: 96_600,
  construction_usd_cents: 3_759_600,
  total_usd_cents: 3_856_200,
  duration_weeks: 24,
  breakdown: { version: 1 },
  usd_to_hnl: 26.5,
  ...overrides,
});

const selection = (category: string, optionId: string, total = 100_000) => ({
  category,
  option_id: optionId,
  quantity: 86,
  unit_price_usd_cents: Math.round(total / 86),
  total_usd_cents: total,
  materials_usd_cents: Math.round(total / 2),
});

const selections = [
  selection("design", CATALOG_PLANS, 45_000),
  selection("permits", BUILDING_PERMIT, 51_600),
  selection("structure", REINFORCED_CONCRETE, 645_000),
  selection("walls", CONCRETE_BLOCK, 989_000),
];

async function submitProject(p: Record<string, unknown>, s: unknown[] = selections) {
  return as(
    service,
    async (db) =>
      (
        await db.query<{ project_id: string; project_code: string }>(
          "select * from public.submit_project($1, $2, $3)",
          [lead(), p, JSON.stringify(s)],
        )
      ).rows[0]!,
    { commit: true },
  );
}

describe("proyectos de construcción", () => {
  let cliente: string;
  let ventas: string;
  let gerente: string;
  let logistica: string;
  let admin: string;
  const token = crypto.randomUUID();
  let projectId: string;

  beforeAll(async () => {
    cliente = await createUser("cliente");
    ventas = await createUser("ventas");
    gerente = await createUser("gerente_proyecto");
    logistica = await createUser("logistica");
    admin = await createUser("admin");
    ({ project_id: projectId } = await submitProject(project({ access_token_hash: hash(token) })));
  });

  describe("catálogo de opciones", () => {
    it("cualquiera lee las opciones activas; las inactivas solo el equipo", async () => {
      const total = await sql("select count(*)::int as n from public.construction_options");
      expect(total.rows[0]!.n).toBeGreaterThan(30);
      expect(
        await rowCount(anon, "select id, name_es, unit_price_usd_cents from public.construction_options"),
      ).toBe(total.rows[0]!.n);
      await sql("update public.construction_options set is_active = false where id = $1", [CONCRETE_BLOCK]);
      try {
        expect(await rowCount(anon, "select 1 from public.construction_options where id = $1", [CONCRETE_BLOCK])).toBe(
          0,
        );
        expect(
          await rowCount(user(ventas), "select 1 from public.construction_options where id = $1", [CONCRETE_BLOCK]),
        ).toBe(1);
      } finally {
        await sql("update public.construction_options set is_active = true where id = $1", [CONCRETE_BLOCK]);
      }
    });

    it("solo admin cambia precios, y el cambio queda en la bitácora", async () => {
      for (const actor of [cliente, ventas, gerente]) {
        expect(
          await rowCount(user(actor), "update public.construction_options set unit_price_usd_cents = 1"),
        ).toBe(0);
      }
      expect(await errorCode(anon, "update public.construction_options set unit_price_usd_cents = 1")).toBe(DENIED);
      expect(
        await rowCount(
          user(admin),
          "update public.construction_options set unit_price_usd_cents = 12000 where id = $1",
          [CONCRETE_BLOCK],
          true,
        ),
      ).toBe(1);
      const audit = await sql(
        `select actor_id, after_data ->> 'unit_price_usd_cents' as after from public.audit_log
         where entity_type = 'construction_options' and entity_id = $1 order by id desc limit 1`,
        [CONCRETE_BLOCK],
      );
      expect(audit.rows[0]).toEqual({ actor_id: admin, after: "12000" });
      await sql("update public.construction_options set unit_price_usd_cents = 11500 where id = $1", [CONCRETE_BLOCK]);
    });

    it("una opción no puede ir en una categoría que no existe o en la etapa equivocada", async () => {
      expect(
        await errorCode(
          user(admin),
          `insert into public.construction_options (stage, category, key, name_es, name_en, description_es, description_en, pricing_basis, unit_price_usd_cents, materials_share_bp, weeks_factor)
           values ('roof', 'walls', 'ladrillo', 'Ladrillo', 'Brick', 'x x', 'x x', 'construction_m2', 100, 5000, 1)`,
        ),
      ).toBe("23514");
      expect(
        await errorCode(
          user(admin),
          `insert into public.construction_options (stage, category, key, name_es, name_en, description_es, description_en, pricing_basis, unit_price_usd_cents, materials_share_bp, weeks_factor)
           values ('finishes', 'piscina', 'grande', 'Piscina', 'Pool', 'x x', 'x x', 'fixed', 100, 5000, 1)`,
        ),
      ).toBe("23514");
    });
  });

  describe("alta y cambios desde el servidor", () => {
    it("submit_project guarda lead, proyecto y selecciones juntos, con un código legible", async () => {
      const { project_id, project_code } = await submitProject(project());
      expect(project_code).toMatch(/^CF-P-[0-9A-F]{6}$/);
      const rows = await sql("select count(*)::int as n from public.project_selections where project_id = $1", [
        project_id,
      ]);
      expect(rows.rows[0]!.n).toBe(selections.length);
      const leadRow = await sql(
        "select l.source from public.projects p join public.leads l on l.id = p.lead_id where p.id = $1",
        [project_id],
      );
      expect(leadRow.rows[0]!.source).toBe("project");
    });

    it("si algo falla, no queda nada a medias (ni el lead)", async () => {
      const before = await sql("select count(*)::int as n from public.leads");
      await expect(
        submitProject(project(), [...selections, selection("roof_cover", CONCRETE_BLOCK)]),
      ).rejects.toThrow();
      const after = await sql("select count(*)::int as n from public.leads");
      expect(after.rows[0]!.n).toBe(before.rows[0]!.n);
    });

    it("rechaza terrenos apartados, totales que no cuadran y opciones de otra categoría", async () => {
      await expect(
        submitProject(project({ land_status: "buying_from_us", lot_id: RESERVED_LOT, lot_price_usd_cents: 1 })),
      ).rejects.toThrow(/Terreno no disponible/);
      await expect(submitProject(project({ total_usd_cents: 1 }))).rejects.toThrow();
      await expect(submitProject(project(), [selection("walls", REINFORCED_CONCRETE)])).rejects.toThrow(
        /Opción no disponible/,
      );
      // Comprar un terreno publicado sí se puede.
      await expect(
        submitProject(
          project({ land_status: "buying_from_us", lot_id: CHOLOMA_LOT, lot_price_usd_cents: 1_280_000 }),
        ),
      ).resolves.toBeTruthy();
    });

    it("cambiar materiales necesita el token correcto y un borrador", async () => {
      const update = (tokenHash: string) =>
        as(
          service,
          async (db) =>
            (
              await db.query<{ id: string }>("select public.update_project_selections($1, $2, $3) as id", [
                tokenHash,
                project({ total_usd_cents: 3_900_000, construction_usd_cents: 3_803_400 }),
                JSON.stringify(selections),
              ])
            ).rows[0]!.id,
          { commit: true },
        );
      expect(await update(hash(token))).toBe(projectId);
      const row = await sql("select total_usd_cents from public.projects where id = $1", [projectId]);
      expect(Number(row.rows[0]!.total_usd_cents)).toBe(3_900_000);
      await expect(update(hash("otro-token"))).rejects.toThrow(/no encontrado/);

      await sql("update public.projects set status = 'in_review' where id = $1", [projectId]);
      try {
        await expect(update(hash(token))).rejects.toThrow(/no editable/);
      } finally {
        await sql("update public.projects set status = 'draft' where id = $1", [projectId]);
      }
    });

    it("una solicitud del panel queda ligada al proyecto del token", async () => {
      const id = await as(
        service,
        async (db) =>
          (
            await db.query<{ id: string }>("select public.submit_project_request($1, 'progress_proof', 'Fotos') as id", [
              hash(token),
            ])
          ).rows[0]!.id,
        { commit: true },
      );
      const row = await sql("select project_id, kind, status from public.project_requests where id = $1", [id]);
      expect(row.rows[0]).toEqual({ project_id: projectId, kind: "progress_proof", status: "open" });
      await expect(
        as(service, (db) => db.query("select public.submit_project_request($1, 'support', '')", [hash("x")])),
      ).rejects.toThrow(/no encontrado/);
    });

    it("nadie fuera del servidor puede llamar a estas funciones", async () => {
      for (const actor of [anon, user(cliente), user(admin)]) {
        expect(
          await errorCode(actor, "select * from public.submit_project($1, $2, '[]'::jsonb)", [lead(), project()]),
        ).toBe(DENIED);
        expect(
          await errorCode(actor, "select public.update_project_selections('x', '{}'::jsonb, '[]'::jsonb)"),
        ).toBe(DENIED);
        expect(await errorCode(actor, "select public.submit_project_request('x', 'support', '')")).toBe(DENIED);
      }
    });
  });

  describe("acceso", () => {
    const tables = ["projects", "project_selections", "project_requests"];

    it("visitantes, clientes, gerentes y logística no ven proyectos ajenos por la API", async () => {
      for (const table of tables) {
        expect(await errorCode(anon, `select 1 from public.${table}`), table).toBe(DENIED);
        for (const actor of [cliente, gerente, logistica]) {
          expect(await rowCount(user(actor), `select 1 from public.${table}`), `${table} / ${actor}`).toBe(0);
        }
      }
    });

    it("ventas y admin ven proyectos, selecciones y solicitudes", async () => {
      for (const staff of [ventas, admin]) {
        expect(await rowCount(user(staff), "select id, code, name from public.projects where id = $1", [projectId])).toBe(
          1,
        );
        expect(
          await rowCount(user(staff), "select 1 from public.project_selections where project_id = $1", [projectId]),
        ).toBe(selections.length);
      }
    });

    it("nadie lee por la API el hash del enlace privado", async () => {
      expect(await errorCode(user(admin), "select access_token_hash from public.projects")).toBe(DENIED);
    });

    it("con sesión nadie crea, borra ni cambia montos; ventas solo cambia el estado (y queda en la bitácora)", async () => {
      for (const actor of [cliente, ventas, admin]) {
        expect(await errorCode(user(actor), "update public.projects set total_usd_cents = 1")).toBe(DENIED);
        expect(await errorCode(user(actor), "delete from public.projects")).toBe(DENIED);
        expect(await errorCode(user(actor), "delete from public.project_selections")).toBe(DENIED);
        expect(
          await errorCode(
            user(actor),
            "insert into public.project_requests (project_id, kind) values ($1, 'support')",
            [projectId],
          ),
        ).toBe(DENIED);
      }
      expect(await rowCount(user(cliente), "update public.projects set status = 'active'")).toBe(0);
      expect(
        await rowCount(user(ventas), "update public.projects set status = 'in_review' where id = $1", [projectId], true),
      ).toBe(1);
      const audit = await sql(
        `select actor_id, after_data ->> 'status' as status from public.audit_log
         where entity_type = 'projects' and entity_id = $1 order by id desc limit 1`,
        [projectId],
      );
      expect(audit.rows[0]).toEqual({ actor_id: ventas, status: "in_review" });
    });
  });
});
