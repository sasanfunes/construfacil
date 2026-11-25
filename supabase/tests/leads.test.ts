import { beforeAll, describe, expect, it } from "vitest";

import { anon, as, createUser, DENIED, errorCode, rowCount, service, sql, user } from "./helpers";

const COPAN = "c3000000-0000-4000-8000-000000000002";
const STANDARD = "d4000000-0000-4000-8000-000000000002";
const CISTERN = "e5000000-0000-4000-8000-000000000002";
const CHOLOMA_LOT = "b2000000-0000-4000-8000-000000000001";
const RESERVED_LOT = "b2000000-0000-4000-8000-000000000006";

const lead = (overrides: Record<string, unknown> = {}) => ({
  source: "contact",
  full_name: "María Hernández",
  email: "Maria.Hernandez@Example.com",
  phone: "+13055550123",
  preferred_channel: "whatsapp",
  locale: "es",
  us_state: "FL",
  message: "Quiero construir en Choloma",
  ...overrides,
});

const quote = (overrides: Record<string, unknown> = {}) => ({
  access_token_hash: crypto.randomUUID().replaceAll("-", "").padEnd(64, "a"),
  locale: "es",
  land_status: "own",
  department_id: 5,
  municipality_id: 2,
  land_area_m2: 200,
  house_model_id: COPAN,
  finish_level_id: STANDARD,
  construction_usd_cents: 4_380_000,
  extras_usd_cents: 190_000,
  total_usd_cents: 4_570_000,
  initial_payment_percent: 20,
  duration_weeks: 22,
  breakdown: { stages: [] },
  usd_to_hnl: 26.5,
  ...overrides,
});

const items = [{ extra_id: CISTERN, quantity: 1, unit_price_usd_cents: 190_000, total_usd_cents: 190_000 }];

const tomorrowPlus = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

async function submitLead(
  payload: Record<string, unknown>,
  videoCall: Record<string, unknown> | null = null,
) {
  return as(
    service,
    async (db) =>
      (await db.query<{ id: string }>("select public.submit_lead($1, $2) as id", [payload, videoCall]))
        .rows[0]!.id,
    { commit: true },
  );
}

async function submitQuote(
  q: Record<string, unknown>,
  i: unknown[] = items,
  videoCall: Record<string, unknown> | null = null,
) {
  return as(
    service,
    async (db) =>
      (
        await db.query<{ quote_id: string; quote_code: string }>(
          "select * from public.submit_quote($1, $2, $3, $4)",
          [lead(), q, JSON.stringify(i), videoCall],
        )
      ).rows[0]!,
    { commit: true },
  );
}

describe("leads y cotizaciones", () => {
  let cliente: string;
  let ventas: string;
  let gerente: string;
  let logistica: string;
  let admin: string;
  let leadId: string;

  beforeAll(async () => {
    cliente = await createUser("cliente");
    ventas = await createUser("ventas");
    gerente = await createUser("gerente_proyecto");
    logistica = await createUser("logistica");
    admin = await createUser("admin");
    leadId = await submitLead(lead(), {
      preferred_date: tomorrowPlus(3),
      time_slot: "evening",
      timezone: "America/New_York",
    });
  });

  describe("alta desde el servidor", () => {
    it("submit_lead guarda el lead normalizado y su videollamada", async () => {
      const { rows } = await sql(
        "select source, status, email, privacy_accepted_at is not null as consent from public.leads where id = $1",
        [leadId],
      );
      expect(rows[0]).toEqual({
        source: "contact",
        status: "new",
        email: "maria.hernandez@example.com",
        consent: true,
      });
      expect(
        await rowCount(service, "select 1 from public.video_call_requests where lead_id = $1", [leadId]),
      ).toBe(1);
    });

    it("el estado y el responsable no se pueden fijar desde el formulario", async () => {
      const id = await submitLead(lead({ status: "won", assigned_to: admin }));
      const { rows } = await sql("select status, assigned_to from public.leads where id = $1", [id]);
      expect(rows[0]).toEqual({ status: "new", assigned_to: null });
    });

    it("la videollamada debe ser desde mañana y dentro de 60 días", async () => {
      for (const date of [tomorrowPlus(-1), tomorrowPlus(0), tomorrowPlus(61)]) {
        await expect(
          submitLead(lead(), { preferred_date: date, time_slot: "morning", timezone: "America/Chicago" }),
        ).rejects.toMatchObject({ code: "23514" });
      }
    });

    it("rechaza correos, teléfonos y zonas horarias mal formados", async () => {
      await expect(submitLead(lead({ email: "no-es-correo" }))).rejects.toMatchObject({ code: "23514" });
      await expect(submitLead(lead({ phone: "llámame" }))).rejects.toMatchObject({ code: "23514" });
      await expect(
        submitLead(lead(), {
          preferred_date: tomorrowPlus(2),
          time_slot: "morning",
          timezone: "'; drop table leads; --",
        }),
      ).rejects.toMatchObject({ code: "23514" });
    });

    it("submit_quote guarda lead, cotización y extras juntos, con un código legible", async () => {
      const result = await submitQuote(quote());
      expect(result.quote_code).toMatch(/^CF-Q-[0-9A-F]{6}$/);
      const { rows } = await sql(
        "select q.valid_until - current_date as valid_days, l.source from public.quotes q join public.leads l on l.id = q.lead_id where q.id = $1",
        [result.quote_id],
      );
      expect(rows[0]).toEqual({ valid_days: 30, source: "quote" });
      expect(
        await rowCount(service, "select 1 from public.quote_items where quote_id = $1", [result.quote_id]),
      ).toBe(1);
    });

    it("si algo falla, no queda nada a medias (ni el lead)", async () => {
      const before = Number((await sql("select count(*) from public.leads")).rows[0]!.count);
      await expect(
        submitQuote(quote(), [
          {
            extra_id: "e5000000-0000-4000-8000-000000000099",
            quantity: 1,
            unit_price_usd_cents: 1,
            total_usd_cents: 1,
          },
        ]),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(submitQuote(quote({ total_usd_cents: 1 }))).rejects.toMatchObject({ code: "23514" });
      const after = Number((await sql("select count(*) from public.leads")).rows[0]!.count);
      expect(after).toBe(before);
    });

    it("no acepta departamentos inactivos, modelo y diseño a la vez, ni terrenos apartados", async () => {
      await expect(submitQuote(quote({ department_id: 2, municipality_id: null }))).rejects.toMatchObject({
        code: "23514",
      });
      await expect(submitQuote(quote({ custom_area_m2: 90 }))).rejects.toMatchObject({ code: "23514" });
      await expect(
        submitQuote(
          quote({ land_status: "buying_from_us", lot_id: RESERVED_LOT, lot_price_usd_cents: 3_600_000 }),
        ),
      ).rejects.toMatchObject({ code: "23514" });
      const ok = await submitQuote(
        quote({ land_status: "buying_from_us", lot_id: CHOLOMA_LOT, lot_price_usd_cents: 1_280_000 }),
      );
      expect(ok.quote_id).toBeTruthy();
    });

    it("nadie fuera del servidor puede llamar a estas funciones", async () => {
      for (const actor of [anon, user(cliente), user(admin)]) {
        expect(await errorCode(actor, "select public.submit_lead($1)", [lead()])).toBe(DENIED);
        expect(
          await errorCode(actor, "select * from public.submit_quote($1, $2, '[]'::jsonb)", [lead(), quote()]),
        ).toBe(DENIED);
      }
    });
  });

  describe("acceso", () => {
    const tables = ["leads", "video_call_requests", "quotes", "quote_items", "funnel_events"];

    it("visitantes, clientes, gerentes y logística no ven nada de captación", async () => {
      for (const table of tables) {
        expect(await errorCode(anon, `select 1 from public.${table}`), table).toBe(DENIED);
        for (const actor of [cliente, gerente, logistica]) {
          expect(await rowCount(user(actor), `select 1 from public.${table}`), `${table} / ${actor}`).toBe(0);
        }
      }
    });

    it("ventas y admin ven leads, cotizaciones y videollamadas", async () => {
      for (const staff of [ventas, admin]) {
        expect(await rowCount(user(staff), "select 1 from public.leads where id = $1", [leadId])).toBe(1);
        expect(
          await rowCount(user(staff), "select 1 from public.video_call_requests where lead_id = $1", [
            leadId,
          ]),
        ).toBe(1);
        expect(
          await rowCount(user(staff), "select id, code, total_usd_cents from public.quotes"),
        ).toBeGreaterThan(0);
      }
    });

    it("nadie lee por la API el hash del enlace privado de una cotización", async () => {
      expect(await errorCode(user(admin), "select access_token_hash from public.quotes")).toBe(DENIED);
    });

    it("con sesión nadie puede crear, borrar ni falsificar leads o cotizaciones", async () => {
      for (const actor of [cliente, ventas, admin]) {
        expect(
          await errorCode(
            user(actor),
            "insert into public.leads (source, full_name, email, locale, privacy_accepted_at) values ('contact', 'X', 'x@x.co', 'es', now())",
          ),
        ).toBe(DENIED);
        expect(await errorCode(user(actor), "delete from public.leads")).toBe(DENIED);
        expect(await errorCode(user(actor), "update public.quotes set total_usd_cents = 1")).toBe(DENIED);
        expect(await errorCode(user(actor), "update public.leads set email = 'otro@example.com'")).toBe(
          DENIED,
        );
        expect(
          await errorCode(
            user(actor),
            "insert into public.funnel_events (event, session_id, locale) values ('quote_started', gen_random_uuid(), 'es')",
          ),
        ).toBe(DENIED);
      }
    });

    it("ventas cambia el estado y asigna el lead, solo a alguien del equipo", async () => {
      expect(
        await rowCount(
          user(ventas),
          "update public.leads set status = 'contacted', assigned_to = $2 where id = $1",
          [leadId, ventas],
          true,
        ),
      ).toBe(1);
      expect(
        await errorCode(user(ventas), "update public.leads set assigned_to = $2 where id = $1", [
          leadId,
          cliente,
        ]),
      ).toBe(DENIED);
      expect(
        await rowCount(user(gerente), "update public.leads set status = 'won' where id = $1", [leadId], true),
      ).toBe(0);
      expect((await sql("select status from public.leads where id = $1", [leadId])).rows[0]?.status).toBe(
        "contacted",
      );
    });

    it("al confirmar una videollamada, la base anota quién y cuándo", async () => {
      expect(
        await rowCount(
          user(ventas),
          "update public.video_call_requests set status = 'confirmed' where lead_id = $1",
          [leadId],
          true,
        ),
      ).toBe(1);
      const { rows } = await sql(
        "select confirmed_by, confirmed_at is not null as stamped from public.video_call_requests where lead_id = $1",
        [leadId],
      );
      expect(rows[0]).toEqual({ confirmed_by: ventas, stamped: true });
      expect(
        await errorCode(
          user(ventas),
          "update public.video_call_requests set confirmed_by = $2 where lead_id = $1",
          [leadId, admin],
        ),
      ).toBe(DENIED);
    });

    it("el servidor registra eventos del embudo, pero no elige su fecha", async () => {
      expect(
        await rowCount(
          service,
          "insert into public.funnel_events (event, step, session_id, locale) values ('quote_step_viewed', 3, gen_random_uuid(), 'en')",
          [],
          true,
        ),
      ).toBe(1);
      expect(
        await errorCode(
          service,
          "insert into public.funnel_events (event, session_id, locale, occurred_at) values ('quote_started', gen_random_uuid(), 'es', '2020-01-01')",
        ),
      ).toBe(DENIED);
      expect(
        await errorCode(
          service,
          "insert into public.funnel_events (event, session_id, locale) values ('visitó_mi_casa', gen_random_uuid(), 'es')",
        ),
      ).toBe("23514");
    });
  });
});
