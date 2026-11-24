import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./fixtures";

test.describe("sitio público", () => {
  test("el inicio carga en español con el botón de WhatsApp", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Tu casa en Honduras, construida desde Estados Unidos",
    );

    const whatsapp = page.getByTestId("whatsapp-button");
    await expect(whatsapp).toBeVisible();
    await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/\d+\?text=/);
    await expect(whatsapp).toHaveAttribute("rel", /noopener/);
  });

  test("el selector cambia a inglés y de vuelta a español", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Your home in Honduras, built from the United States",
    );

    await page.getByRole("link", { name: "Español" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  test("/es redirige a la ruta sin prefijo", async ({ page }) => {
    await page.goto("/es");
    await expect(page).toHaveURL(/\/$/);
  });

  test("no hay scroll horizontal", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("una ruta que no existe muestra el 404 traducido", async ({ page }) => {
    // El 404 escribe un error de red en consola; aquí es lo esperado.
    page.removeAllListeners("console");

    const response = await page.goto("/esta-pagina-no-existe");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("No encontramos esta página");

    await page.goto("/en/this-page-does-not-exist");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We can't find this page");
  });

  test("el inicio pasa la revisión automática de accesibilidad (WCAG 2.1 AA)", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
  });
});

test.describe("seguridad", () => {
  test("las páginas públicas llevan las cabeceras de seguridad", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["strict-transport-security"]).toContain("max-age=63072000");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("el área privada usa CSP con nonce, no se cachea y no se indexa", async ({ page }) => {
    const response = await page.goto("/portal");
    const headers = response?.headers() ?? {};
    const csp = headers["content-security-policy"] ?? "";

    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).not.toContain("'unsafe-inline' 'unsafe-eval'");
    expect(csp.split(";").find((part) => part.trim().startsWith("script-src"))).not.toContain(
      "unsafe-inline",
    );
    expect(headers["cache-control"]).toContain("no-store");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Portal del cliente");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("cada visita al área privada recibe un nonce distinto", async ({ request }) => {
    const nonceOf = async () => {
      const response = await request.get("/portal");
      return /'nonce-([^']+)'/.exec(response.headers()["content-security-policy"] ?? "")?.[1];
    };
    const [first, second] = [await nonceOf(), await nonceOf()];
    expect(first).toBeTruthy();
    expect(first).not.toBe(second);
  });
});

test.describe("proxy", () => {
  // Rutas que el enrutador de idiomas limpiaría hasta /portal: se rechazan antes.
  for (const path of ["/por%09tal", "/en/por%0Atal", "/en/portal%20", "/en/%09/portal", "/%zz"]) {
    test(`rechaza la ruta malformada ${path}`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(400);
    });
  }

  test("una ruta privada con punto también recibe la CSP con nonce", async ({ request }) => {
    const response = await request.get("/portal/contrato.pdf");
    expect(response.headers()["content-security-policy"]).toMatch(/'nonce-[^']+' 'strict-dynamic'/);
    expect(response.headers()["cache-control"]).toContain("no-store");
  });

  test("una ruta inexistente del área privada muestra el 404 sin violar la CSP", async ({ page }) => {
    const cspViolations: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy/i.test(message.text())) cspViolations.push(message.text());
    });

    // Aquí Next responde 200 porque ya empezó a enviar la página cuando descubre que no existe
    // (comportamiento documentado del streaming). Lo que importa: se ve el 404, no se indexa
    // y la CSP estricta sigue en pie.
    const response = await page.goto("/portal/esta-pagina-no-existe");
    expect(response?.headers()["content-security-policy"]).toContain("'strict-dynamic'");
    expect(response?.headers()["cache-control"]).toContain("no-store");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("No encontramos esta página");
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    expect(cspViolations).toEqual([]);
  });

  test("una /api que no existe responde 404 sin pasar por la app", async ({ request }) => {
    for (const path of ["/api", "/api/lo-que-sea", "/api/users.json"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
      expect(await response.text(), path).toBe("");
    }
  });

  test("las rutas desconocidas con punto o que empiezan por 'api' van al 404 traducido", async ({ page }) => {
    page.removeAllListeners("console");
    for (const path of ["/archivo-inexistente.x", "/apidos"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("No encontramos esta página");
    }
  });

  test("ignora una CSP enviada por el navegador: no puede colar su propio nonce", async ({ request }) => {
    const forged = "QVRBQ0FOVEU";
    const response = await request.get(`/ruta-sin-cache-${Date.now()}`, {
      headers: { "Content-Security-Policy": `script-src 'nonce-${forged}'`, "x-nonce": forged },
    });
    expect(await response.text()).not.toContain(forged);

    const portal = await request.get("/portal", {
      headers: { "Content-Security-Policy": `script-src 'nonce-${forged}'`, "x-nonce": forged },
    });
    expect(await portal.text()).not.toContain(forged);
    expect(portal.headers()["content-security-policy"]).not.toContain(forged);
  });

  test("no arma enlaces con un Host falsificado", async ({ request }) => {
    const response = await request.get("/", { headers: { "X-Forwarded-Host": "evil.example" } });
    expect(response.headers()["link"] ?? "").not.toContain("evil.example");
    expect(await response.text()).not.toContain("evil.example");
  });

  test("el ícono del sitio se sirve tal cual", async ({ request }) => {
    const response = await request.get("/icon.svg");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/svg+xml");
  });
});
