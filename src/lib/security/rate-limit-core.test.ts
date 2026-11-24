import { describe, expect, it } from "vitest";

import { buildBucket, getClientIp, MemoryRateLimitStore, RATE_LIMITS } from "./rate-limit-core";

describe("buildBucket", () => {
  const salt = "sal-de-prueba-con-mas-de-treinta-y-dos-caracteres";

  it("no deja la IP ni el correo en claro", () => {
    const bucket = buildBucket("login", "ana@example.com", salt);
    expect(bucket).toMatch(/^login:[0-9a-f]{40}$/);
    expect(bucket).not.toContain("ana");
  });

  it("es estable e ignora mayúsculas y espacios", () => {
    expect(buildBucket("login", " Ana@Example.com ", salt)).toBe(
      buildBucket("login", "ana@example.com", salt),
    );
  });

  it("cambia con la acción, el identificador y la sal", () => {
    const base = buildBucket("login", "1.2.3.4", salt);
    expect(buildBucket("quote", "1.2.3.4", salt)).not.toBe(base);
    expect(buildBucket("login", "1.2.3.5", salt)).not.toBe(base);
    expect(buildBucket("login", "1.2.3.4", `${salt}-otra`)).not.toBe(base);
  });
});

describe("getClientIp", () => {
  it("prefiere la cabecera de Vercel y toma la primera IP de x-forwarded-for", () => {
    expect(
      getClientIp(new Headers({ "x-vercel-forwarded-for": "9.9.9.9", "x-forwarded-for": "1.1.1.1" })),
    ).toBe("9.9.9.9");
    expect(getClientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1");
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

describe("MemoryRateLimitStore", () => {
  it("permite hasta el límite, bloquea después y se reinicia con la ventana", async () => {
    let now = 1_000_000;
    const store = new MemoryRateLimitStore(() => now);
    const rule = { limit: 2, windowSeconds: 60 };

    expect(await store.hit("a", rule)).toMatchObject({ allowed: true, remaining: 1 });
    expect(await store.hit("a", rule)).toMatchObject({ allowed: true, remaining: 0 });
    expect(await store.hit("a", rule)).toMatchObject({ allowed: false, remaining: 0 });
    expect(await store.hit("b", rule)).toMatchObject({ allowed: true });

    now += 60_000;
    expect(await store.hit("a", rule)).toMatchObject({ allowed: true, remaining: 1 });
  });
});

describe("RATE_LIMITS", () => {
  it("cubre login, registro, contacto y cotizador, como pide el brief", () => {
    expect(Object.keys(RATE_LIMITS)).toEqual(
      expect.arrayContaining(["login", "signup", "contactForm", "quote"]),
    );
    for (const rule of Object.values(RATE_LIMITS)) {
      expect(rule.limit).toBeGreaterThan(0);
      expect(rule.windowSeconds).toBeGreaterThanOrEqual(60);
    }
  });
});
