import { describe, expect, it } from "vitest";

import { buildBucket, getClientIp, MemoryRateLimitStore, normalizeIp, RATE_LIMITS } from "./rate-limit-core";

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
  });

  it("devuelve null si no hay IP o si la cabecera trae basura", () => {
    expect(getClientIp(new Headers())).toBeNull();
    expect(getClientIp(new Headers({ "x-forwarded-for": "no-soy-una-ip" }))).toBeNull();
    expect(getClientIp(new Headers({ "x-real-ip": "999.1.1.1" }))).toBeNull();
  });
});

describe("normalizeIp", () => {
  it("deja las IPv4 como están", () => {
    expect(normalizeIp(" 203.0.113.7 ")).toBe("203.0.113.7");
    expect(normalizeIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("agrupa las IPv6 por bloque /64: una misma conexión no tiene millones de contadores", () => {
    const a = normalizeIp("2001:db8:abcd:12:1111:2222:3333:4444");
    const b = normalizeIp("2001:0db8:abcd:0012:ffff:ffff:ffff:ffff");
    expect(a).toBe("2001:db8:abcd:12::/64");
    expect(b).toBe(a);
    expect(normalizeIp("2001:db8:abcd:13::1")).not.toBe(a);
    expect(normalizeIp("[2001:db8::1]")).toBe("2001:db8:0:0::/64");
    expect(normalizeIp("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
    expect(normalizeIp("::1")).toBe("0:0:0:0::/64");
  });

  it("rechaza lo que no es una IP", () => {
    expect(normalizeIp("")).toBeNull();
    expect(normalizeIp("localhost")).toBeNull();
    expect(normalizeIp("1.2.3")).toBeNull();
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
