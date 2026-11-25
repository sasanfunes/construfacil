import { describe, expect, it } from "vitest";

import { isHttpsSite, staticSecurityHeaders } from "./headers";

describe("staticSecurityHeaders", () => {
  const headers = Object.fromEntries(
    staticSecurityHeaders({ isDev: false, siteUrl: "https://construfacil.example" }).map(({ key, value }) => [
      key,
      value,
    ]),
  );

  it("incluye las cabeceras mínimas de seguridad", () => {
    expect(headers["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains; preload");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Content-Security-Policy"]).toContain("upgrade-insecure-requests");
  });

  it("no fuerza https en localhost", () => {
    const local = staticSecurityHeaders({ isDev: false, siteUrl: "http://localhost:3000" });
    expect(local.find(({ key }) => key === "Content-Security-Policy")?.value).not.toContain(
      "upgrade-insecure-requests",
    );
    expect(isHttpsSite(undefined)).toBe(false);
  });
});
