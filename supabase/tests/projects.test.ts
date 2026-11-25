import { createHash } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { projectRulesFrom } from "@/features/catalog/catalog";
import { SAMPLE_CATALOG } from "@/features/catalog/sample";
import { defaultOptionIds, estimateProject } from "@/features/projects/engine";
import { projectPayload, selectionsPayload } from "@/features/projects/payload";
import type { ProjectInput } from "@/features/projects/types";

import { anon, as, createUser, DENIED, errorCode, rowCount, service, sql, user } from "./helpers";

const COPAN = "c3000000-0000-4000-8000-000000000002";
const CHOLOMA_LOT = "b2000000-0000-4000-8000-000000000001";
const RESERVED_LOT = "b2000000-0000-4000-8000-000000000006";
const CORTES = 5; // factor 1.0
const FRANCISCO_MORAZAN = 8; // factor 1.04

// El catálogo de ejemplo es el mismo que carga supabase/seed.sql.
const rules = projectRulesFrom(SAMPLE_CATALOG);
const optionOf = (category: string, key: string) =>
  SAMPLE_CATALOG.constructionOptions.find((o) => o.category === category && o.key === key)!.id;
const CONCRETE_BLOCK = optionOf("walls", "concrete_block");
const POLYSTYRENE_PANEL = optionOf("walls", "polystyrene_panel");
const REINFORCED_CONCRETE = optionOf("structure", "reinforced_concrete");

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

const lead = (overrides: Record<string, unknown> = {}) => ({
  full_name: "María Hernández",
  email: "maria.hernandez@example.com",
  phone: "+13055550123",
  preferred_channel: "whatsapp",
  locale: "es",
  ...overrides,
});

type Payload = Record<string, unknown>;
type Selection = Record<string, unknown>;

const baseInput: ProjectInput = {
  landStatus: "own",
  lotId: null,
  departmentId: CORTES,
  municipalityId: 2,
  landAreaM2: 300,
  designSource: "catalog",
  houseModelId: COPAN,
  areaM2: null,
  floors: 1,
  bedrooms: 3,
  bathrooms: 2,
  optionIds: defaultOptionIds(SAMPLE_CATALOG.constructionOptions, 1),
};

const withWalls = (wallsId: string) => [
  ...baseInput.optionIds.filter(
    (id) => SAMPLE_CATALOG.constructionOptions.find((o) => o.id === id)?.category !== "walls",
  ),
  wallsId,
];

/** Un proyecto con montos de verdad: los calcula el mismo motor que usa el servidor. */
function build(overrides: Partial<ProjectInput> = {}, tokenHash = hash(crypto.randomUUID())) {
  const input = { ...baseInput, ...overrides };
  const estimate = estimateProject(input, rules);
  const stored: ProjectInput = { ...input, ...estimate.location, areaM2: estimate.design.areaM2 };
  return {
    estimate,
    project: projectPayload({
      tokenHash,
      name: "Casa de mamá en Choloma",
      locale: "es",
      input: stored,
      estimate,
      usdToHnl: 26.5,
    }) as Payload,
    /** Lo que manda el panel al cambiar materiales: solo montos. */
    update: projectPayload({ input: stored, estimate, usdToHnl: 26.5 }) as Payload,
    selections: selectionsPayload(estimate) as Selection[],
  };
}

/** Cambia una opción de la lista (por categoría). */
const patchSelection = (list: Selection[], category: string, patch: Selection) =>
  list.map((s) => (s.category === category ? { ...s, ...patch } : s));

async function submitProject(p: Payload, s: unknown[]) {
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
  const initial = build({}, hash(token));
  let projectId: string;

  beforeAll(async () => {
    cliente = await createUser("cliente");
    ventas = await createUser("ventas");
    gerente = await createUser("gerente_proyecto");
    logistica = await createUser("logistica");
    admin = await createUser("admin");
    ({ project_id: projectId } = await submitProject(initial.project, initial.selections));
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
        expect(
          await rowCount(anon, "select 1 from public.construction_options where id = $1", [CONCRETE_BLOCK]),
        ).toBe(0);
        expect(
          await rowCount(user(ventas), "select 1 from public.construction_options where id = $1", [
            CONCRETE_BLOCK,
          ]),
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
      expect(await errorCode(anon, "update public.construction_options set unit_price_usd_cents = 1")).toBe(
        DENIED,
      );
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
      await sql("update public.construction_options set unit_price_usd_cents = 11500 where id = $1", [
        CONCRETE_BLOCK,
      ]);
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
      const created = build();
      const { project_id, project_code } = await submitProject(created.project, created.selections);
      expect(project_code).toMatch(/^CF-P-[0-9A-F]{6}$/);
      const rows = await sql(
        "select count(*)::int as n from public.project_selections where project_id = $1",
        [project_id],
      );
      expect(rows.rows[0]!.n).toBe(created.selections.length);
      const leadRow = await sql(
        "select l.source from public.projects p join public.leads l on l.id = p.lead_id where p.id = $1",
        [project_id],
      );
      expect(leadRow.rows[0]!.source).toBe("project");
    });

    it("si algo falla, no queda nada a medias (ni el lead)", async () => {
      const before = await sql("select count(*)::int as n from public.leads");
      await expect(
        submitProject(initial.project, [
          ...initial.selections,
          { ...initial.selections[0], category: "roof_cover", option_id: CONCRETE_BLOCK },
        ]),
      ).rejects.toThrow();
      const after = await sql("select count(*)::int as n from public.leads");
      expect(after.rows[0]!.n).toBe(before.rows[0]!.n);
    });

    it("rechaza terrenos apartados o con otro precio, modelos alterados y opciones de otra categoría", async () => {
      const buying = build({ landStatus: "buying_from_us", lotId: CHOLOMA_LOT });
      await expect(
        submitProject({ ...buying.project, lot_id: RESERVED_LOT }, buying.selections),
      ).rejects.toThrow(/Terreno no disponible/);
      await expect(
        submitProject(
          { ...buying.project, lot_price_usd_cents: Number(buying.project.lot_price_usd_cents) - 100_000 },
          buying.selections,
        ),
      ).rejects.toThrow(/Terreno no disponible/);
      await expect(submitProject({ ...initial.project, area_m2: 40 }, initial.selections)).rejects.toThrow(
        /Modelo no disponible/,
      );
      await expect(
        submitProject({ ...initial.project, total_usd_cents: 1 }, initial.selections),
      ).rejects.toThrow();
      await expect(
        submitProject(
          initial.project,
          patchSelection(initial.selections, "walls", { option_id: REINFORCED_CONCRETE }),
        ),
      ).rejects.toThrow(/Opción no disponible/);
      // Comprar un terreno publicado, a su precio, sí se puede.
      await expect(submitProject(buying.project, buying.selections)).resolves.toBeTruthy();
    });

    it("la base rechaza montos que no cuadran con el catálogo, aunque vengan del servidor", async () => {
      const valid = build({ optionIds: withWalls(POLYSTYRENE_PANEL) });
      const walls = valid.selections.find((s) => s.category === "walls")!;
      const amount = (key: string) => Number(walls[key]);
      for (const forged of [
        { unit_price_usd_cents: amount("unit_price_usd_cents") - 1 },
        { quantity: Number(walls.quantity) + 1 },
        { total_usd_cents: amount("total_usd_cents") + 50_000 },
        { materials_usd_cents: 0 },
      ]) {
        await expect(
          submitProject(valid.project, patchSelection(valid.selections, "walls", forged)),
          JSON.stringify(forged),
        ).rejects.toThrow(/no cuadran con el catálogo/);
      }

      // Sin una opción, las etapas ya no suman los totales.
      await expect(
        submitProject(
          valid.project,
          valid.selections.filter((s) => s.category !== "walls"),
        ),
      ).rejects.toThrow(/totales del proyecto no cuadran/);

      // El factor del departamento cuenta: calculado para Francisco Morazán, guardado en Cortés.
      const pricier = build({ departmentId: FRANCISCO_MORAZAN, municipalityId: null });
      await expect(
        submitProject({ ...pricier.project, department_id: CORTES }, pricier.selections),
      ).rejects.toThrow(/no cuadran con el catálogo/);

      // El desglose que ve el cliente dice lo mismo que las columnas.
      const breakdown = valid.project.breakdown as { estimate: Record<string, unknown> };
      await expect(
        submitProject(
          {
            ...valid.project,
            breakdown: { ...breakdown, estimate: { ...breakdown.estimate, totalUsdCents: 1 } },
          },
          valid.selections,
        ),
      ).rejects.toThrow(/desglose no coincide/);

      await expect(submitProject(valid.project, valid.selections)).resolves.toBeTruthy();
    });

    it("cambiar materiales necesita el token correcto, un borrador y montos que cuadren", async () => {
      const changed = build({ optionIds: withWalls(POLYSTYRENE_PANEL) });
      const update = (tokenHash: string, payload = changed.update, list = changed.selections) =>
        as(
          service,
          async (db) =>
            (
              await db.query<{ id: string }>("select public.update_project_selections($1, $2, $3) as id", [
                tokenHash,
                payload,
                JSON.stringify(list),
              ])
            ).rows[0]!.id,
          { commit: true },
        );
      expect(await update(hash(token))).toBe(projectId);
      const row = await sql("select total_usd_cents from public.projects where id = $1", [projectId]);
      expect(Number(row.rows[0]!.total_usd_cents)).toBe(changed.estimate.totalUsdCents);
      expect(changed.estimate.totalUsdCents).not.toBe(initial.estimate.totalUsdCents);

      // El cambio de montos queda en la bitácora, sin el hash del enlace ni el desglose.
      const audit = await sql(
        `select before_data, after_data from public.audit_log
         where entity_type = 'projects' and entity_id = $1 order by id desc limit 1`,
        [projectId],
      );
      expect(audit.rows[0]!.before_data.total_usd_cents).toBe(initial.estimate.totalUsdCents);
      expect(audit.rows[0]!.after_data.total_usd_cents).toBe(changed.estimate.totalUsdCents);
      expect(Object.keys(audit.rows[0]!.after_data).sort()).toEqual([
        "code",
        "construction_usd_cents",
        "preliminary_usd_cents",
        "status",
        "total_usd_cents",
      ]);

      await expect(
        update(
          hash(token),
          changed.update,
          patchSelection(changed.selections, "walls", { unit_price_usd_cents: 1 }),
        ),
      ).rejects.toThrow(/no cuadran con el catálogo/);
      await expect(update(hash("otro-token"))).rejects.toThrow(/no encontrado/);

      await sql("update public.projects set status = 'in_review' where id = $1", [projectId]);
      try {
        await expect(update(hash(token))).rejects.toThrow(/no editable/);
      } finally {
        await sql("update public.projects set status = 'draft' where id = $1", [projectId]);
      }
    });

    it("el estado avanza en orden y cerrado es final", async () => {
      const other = build();
      const { project_id: id } = await submitProject(other.project, other.selections);
      const setStatus = (status: string) =>
        sql("update public.projects set status = $2 where id = $1", [id, status]);
      await setStatus("in_review");
      await setStatus("draft");
      await setStatus("in_review");
      await setStatus("active");
      await expect(setStatus("draft")).rejects.toThrow(/Cambio de estado no permitido/);
      await expect(setStatus("in_review")).rejects.toThrow(/Cambio de estado no permitido/);
      await setStatus("closed");
      for (const status of ["draft", "in_review", "active"]) {
        await expect(setStatus(status)).rejects.toThrow(/Cambio de estado no permitido/);
      }
    });

    it("una solicitud del panel queda ligada al proyecto del token", async () => {
      const id = await as(
        service,
        async (db) =>
          (
            await db.query<{ id: string }>(
              "select public.submit_project_request($1, 'progress_proof', 'Fotos') as id",
              [hash(token)],
            )
          ).rows[0]!.id,
        { commit: true },
      );
      const row = await sql("select project_id, kind, status from public.project_requests where id = $1", [
        id,
      ]);
      expect(row.rows[0]).toEqual({ project_id: projectId, kind: "progress_proof", status: "open" });
      await expect(
        as(service, (db) => db.query("select public.submit_project_request($1, 'support', '')", [hash("x")])),
      ).rejects.toThrow(/no encontrado/);
    });

    it("nadie fuera del servidor puede llamar a estas funciones", async () => {
      for (const actor of [anon, user(cliente), user(admin)]) {
        expect(
          await errorCode(actor, "select * from public.submit_project($1, $2, '[]'::jsonb)", [
            lead(),
            initial.project,
          ]),
        ).toBe(DENIED);
        expect(
          await errorCode(actor, "select public.update_project_selections('x', '{}'::jsonb, '[]'::jsonb)"),
        ).toBe(DENIED);
        expect(await errorCode(actor, "select public.submit_project_request('x', 'support', '')")).toBe(
          DENIED,
        );
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
        expect(
          await rowCount(user(staff), "select id, code, name from public.projects where id = $1", [
            projectId,
          ]),
        ).toBe(1);
        expect(
          await rowCount(user(staff), "select 1 from public.project_selections where project_id = $1", [
            projectId,
          ]),
        ).toBe(initial.selections.length);
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
        await rowCount(
          user(ventas),
          "update public.projects set status = 'in_review' where id = $1",
          [projectId],
          true,
        ),
      ).toBe(1);
      const audit = await sql(
        `select actor_id, after_data ->> 'status' as status from public.audit_log
         where entity_type = 'projects' and entity_id = $1 order by id desc limit 1`,
        [projectId],
      );
      expect(audit.rows[0]).toEqual({ actor_id: ventas, status: "in_review" });
      await sql("update public.projects set status = 'draft' where id = $1", [projectId]);
    });
  });
});
