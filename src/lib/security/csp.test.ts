import { describe, expect, it } from "vitest";

import { buildCsp, generateNonce } from "./csp";

const directive = (csp: string, name: string) =>
  csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `) || part === name);

describe("buildCsp", () => {
  const base = { isDev: false, upgradeInsecureRequests: true };

  it("con nonce es estricta: sin unsafe-inline ni unsafe-eval en scripts", () => {
    const scripts = directive(buildCsp({ ...base, nonce: "abc123" }), "script-src");
    expect(scripts).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
  });

  it("sin nonce permite scripts en línea (páginas prerenderizadas) pero ningún dominio externo", () => {
    const scripts = directive(buildCsp(base), "script-src");
    expect(scripts).toBe("script-src 'self' 'unsafe-inline'");
  });

  it("unsafe-eval solo aparece en desarrollo", () => {
    expect(buildCsp({ ...base, isDev: true })).toContain("'unsafe-eval'");
    expect(buildCsp(base)).not.toContain("'unsafe-eval'");
    expect(buildCsp({ ...base, nonce: "n" })).not.toContain("'unsafe-eval'");
  });

  it("siempre bloquea iframes, plugins, base y formularios hacia fuera", () => {
    for (const csp of [buildCsp(base), buildCsp({ ...base, nonce: "n" })]) {
      expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
      expect(directive(csp, "object-src")).toBe("object-src 'none'");
      expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
      expect(directive(csp, "form-action")).toBe("form-action 'self'");
      expect(directive(csp, "default-src")).toBe("default-src 'self'");
    }
  });

  it("permite solo el proyecto de Supabase configurado, por https y wss", () => {
    const csp = buildCsp({ ...base, supabaseUrl: "https://abc.supabase.co" });
    expect(directive(csp, "connect-src")).toBe(
      "connect-src 'self' https://abc.supabase.co wss://abc.supabase.co",
    );
    expect(directive(csp, "img-src")).toContain("https://abc.supabase.co");
    expect(csp).not.toContain("*.supabase.co");
  });

  it("ignora una URL de Supabase mal escrita en vez de romper la política", () => {
    expect(directive(buildCsp({ ...base, supabaseUrl: "no-es-url; script-src *" }), "connect-src")).toBe(
      "connect-src 'self'",
    );
  });

  it("upgrade-insecure-requests solo cuando el sitio es https", () => {
    expect(buildCsp(base)).toContain("upgrade-insecure-requests");
    expect(buildCsp({ ...base, upgradeInsecureRequests: false })).not.toContain("upgrade-insecure-requests");
  });
});

describe("generateNonce", () => {
  it("genera valores distintos y válidos para una cabecera", () => {
    const nonces = new Set(Array.from({ length: 50 }, generateNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
  });
});
