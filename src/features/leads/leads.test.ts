import { describe, expect, it } from "vitest";

import { looksLikeBot } from "./bot-check";
import {
  addDays,
  contactInfoSchema,
  fieldErrorsOf,
  isValidTimeZone,
  leadRequestFromFormData,
  leadRequestSchema,
  normalizePhone,
} from "./schemas";
import { hashAccessToken, isWellFormedAccessToken, newAccessToken } from "./token";

const TODAY = "2026-11-25";

const valid = {
  fullName: "  María Hernández ",
  email: " Maria@Example.COM ",
  phone: "+1 (305) 555-0123",
  preferredChannel: "whatsapp",
  privacy: true,
};

describe("contactInfoSchema", () => {
  it("normaliza nombre, correo y teléfono", () => {
    expect(contactInfoSchema.parse(valid)).toEqual({
      fullName: "María Hernández",
      email: "maria@example.com",
      phone: "+13055550123",
      preferredChannel: "whatsapp",
      privacy: true,
    });
  });

  it("pide teléfono si prefiere WhatsApp o llamada, pero no si prefiere correo", () => {
    const withoutPhone = { ...valid, phone: "" };
    const result = contactInfoSchema.safeParse(withoutPhone);
    expect(result.success).toBe(false);
    expect(fieldErrorsOf(result.error!)).toEqual({ phone: "phoneRequired" });
    expect(contactInfoSchema.safeParse({ ...withoutPhone, preferredChannel: "email" }).success).toBe(true);
  });

  it("devuelve llaves de traducción como errores", () => {
    const result = contactInfoSchema.safeParse({ fullName: "A", email: "no", phone: "123", privacy: false });
    expect(fieldErrorsOf(result.error!)).toEqual({
      fullName: "nameTooShort",
      email: "emailInvalid",
      phone: "phoneInvalid",
      privacy: "privacyRequired",
    });
  });

  it("acepta nombres con tildes, apóstrofos y guiones, y rechaza URLs, correos y números", () => {
    for (const fullName of ["José Ñúñez", "María-José O'Connor", "Ana  María   López", "Zoë D’Arcy"]) {
      expect(contactInfoSchema.safeParse({ ...valid, fullName }).success, fullName).toBe(true);
    }
    expect(contactInfoSchema.parse({ ...valid, fullName: "Ana  María   López" }).fullName).toBe(
      "Ana María López",
    );
    for (const fullName of [
      "https://evil.example/verificar Pérez",
      "ana@correo.com",
      "Juan 2",
      "<b>Ana</b>",
      "\u202eAna",
    ]) {
      const result = contactInfoSchema.safeParse({ ...valid, fullName });
      expect(result.success, fullName).toBe(false);
      expect(fieldErrorsOf(result.error!).fullName, fullName).toBe("nameInvalid");
    }
  });

  it("rechaza estados que no existen", () => {
    expect(contactInfoSchema.safeParse({ ...valid, usState: "XX" }).success).toBe(false);
    expect(contactInfoSchema.parse({ ...valid, usState: "TX" }).usState).toBe("TX");
  });
});

describe("leadRequestSchema", () => {
  const schema = leadRequestSchema(TODAY);

  it("una videollamada exige fecha válida dentro de 60 días y una zona horaria real", () => {
    const base = { ...valid, intent: "video_call", wantsCall: true };
    const call = (date: string, timezone = "America/New_York") => ({
      ...base,
      videoCall: { date, timeSlot: "evening", timezone },
    });
    expect(schema.safeParse(call(addDays(TODAY, 1))).success).toBe(true);
    expect(schema.safeParse(call(TODAY)).success).toBe(false);
    expect(schema.safeParse(call(addDays(TODAY, 61))).success).toBe(false);
    expect(schema.safeParse(call(addDays(TODAY, 3), "Mars/Olympus")).success).toBe(false);
    expect(fieldErrorsOf(schema.safeParse(base).error!)).toEqual({ "videoCall.date": "required" });
  });

  it("un intent desconocido cae a contacto y los ids deben ser UUID", () => {
    expect(schema.parse({ ...valid, intent: "hackear" }).intent).toBe("contact");
    expect(schema.safeParse({ ...valid, homeId: "1 or 1=1" }).success).toBe(false);
  });

  it("lee el FormData del formulario", () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({
      fullName: "Ana",
      email: "ana@example.com",
      phone: "50499998888",
      preferredChannel: "phone",
      privacy: "on",
      intent: "video_call",
      callDate: addDays(TODAY, 2),
      callTimeSlot: "morning",
      callTimezone: "America/Chicago",
      homeId: "a1000000-0000-4000-8000-000000000001",
    })) {
      form.set(key, value);
    }
    const parsed = schema.parse(leadRequestFromFormData(form));
    expect(parsed).toMatchObject({
      intent: "video_call",
      wantsCall: true,
      homeId: "a1000000-0000-4000-8000-000000000001",
      videoCall: { timeSlot: "morning", timezone: "America/Chicago" },
    });
  });
});

describe("utilidades", () => {
  it("normalizePhone", () => {
    expect(normalizePhone("(504) 9999-8888")).toBe("50499998888");
    expect(normalizePhone(" +504 9999 8888 ")).toBe("+50499998888");
  });

  it("isValidTimeZone", () => {
    expect(isValidTimeZone("America/Tegucigalpa")).toBe(true);
    expect(isValidTimeZone("America/Argentina/Buenos_Aires")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("America/Nowhere")).toBe(false);
    expect(isValidTimeZone("'; drop table leads; --")).toBe(false);
  });

  it("addDays cruza meses y años", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-11-25", 60)).toBe("2027-01-24");
  });
});

describe("looksLikeBot", () => {
  const now = 1_000_000;
  it("detecta el campo trampa y los envíos instantáneos", () => {
    expect(looksLikeBot({ honeypot: "http://spam", startedAt: now - 60_000, now })).toBe(true);
    expect(looksLikeBot({ honeypot: "", startedAt: now - 500, now })).toBe(true);
    expect(looksLikeBot({ honeypot: "", startedAt: "nada", now })).toBe(true);
    expect(looksLikeBot({ honeypot: "", startedAt: now + 3_600_000, now })).toBe(true);
  });

  it("deja pasar a una persona", () => {
    expect(looksLikeBot({ honeypot: "", startedAt: String(now - 45_000), now })).toBe(false);
    expect(looksLikeBot({ honeypot: undefined, startedAt: now - 3_000, now })).toBe(false);
  });
});

describe("token de cotización", () => {
  it("es largo, aleatorio, con formato de URL, y su hash es SHA-256", () => {
    const a = newAccessToken();
    const b = newAccessToken();
    expect(a).not.toBe(b);
    expect(isWellFormedAccessToken(a)).toBe(true);
    expect(hashAccessToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashAccessToken(a)).toBe(hashAccessToken(a));
  });

  it("rechaza tokens mal formados antes de tocar la base", () => {
    expect(isWellFormedAccessToken("corto")).toBe(false);
    expect(isWellFormedAccessToken(`${"a".repeat(42)}/`)).toBe(false);
  });
});
