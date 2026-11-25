import AxeBuilder from "@axe-core/playwright";

import { expect, horizontalOverflow, test, visibleHeading } from "./fixtures";

/** Páginas públicas en los dos idiomas: [español, inglés]. */
const PUBLIC_PAGES = [
  ["/", "/en"],
  ["/casas", "/en/homes"],
  ["/casas/casa-copan-choloma", "/en/homes/casa-copan-choloma"],
  ["/construir", "/en/build"],
  ["/construir/modelos/modelo-copan", "/en/build/models/modelo-copan"],
  ["/construir/nuevo", "/en/build/new"],
  ["/calculadora", "/en/calculator"],
  ["/como-funciona", "/en/how-it-works"],
  ["/por-que-confiar", "/en/why-trust-us"],
  ["/preguntas-frecuentes", "/en/faq"],
  ["/contacto", "/en/contact"],
  ["/agendar", "/en/schedule"],
  ["/legal/terminos", "/en/legal/terms"],
  ["/legal/privacidad", "/en/legal/privacy"],
  ["/legal/reembolsos", "/en/legal/refunds"],
  ["/legal/pagos", "/en/legal/payments"],
] as const;

test.describe("páginas públicas", () => {
  for (const [es, en] of PUBLIC_PAGES) {
    test(`${es} y ${en} cargan con su título y sin scroll horizontal`, async ({ page }) => {
      for (const [path, lang] of [
        [es, "es"],
        [en, "en"],
      ] as const) {
        const response = await page.goto(path);
        expect(response?.status(), path).toBe(200);
        await expect(page.locator("html"), path).toHaveAttribute("lang", lang);
        await expect(visibleHeading(page), path).toHaveCount(1);
        await expect(page.getByTestId("whatsapp-button"), path).toBeVisible();
        expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(0);
      }
    });
  }

  // El inicio ya se revisa en smoke.spec.ts.
  for (const path of [
    "/casas",
    "/casas/casa-copan-choloma",
    "/casas?view=map",
    "/construir/modelos/modelo-copan",
    "/construir",
    "/construir/nuevo",
    "/calculadora",
    "/preguntas-frecuentes",
    "/contacto",
    "/legal/privacidad",
    "/en/build",
  ]) {
    test(`${path} pasa la revisión automática de accesibilidad`, async ({ page }) => {
      await page.goto(path);
      await expect(visibleHeading(page)).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
    });
  }

  test("la calculadora recalcula al cambiar el monto mensual", async ({ page }) => {
    await page.goto("/calculadora");
    const result = page.getByText(/^Empiezas tu obra en|^Puedes empezar tu obra ya/);
    await expect(result).toBeVisible();
    const before = await result.innerText();

    await page.getByRole("spinbutton", { name: "¿Cuánto puedes apartar cada mes? (USD)" }).fill("1500");
    await expect(result).not.toHaveText(before);
  });
});

test.describe("SEO", () => {
  test("cada página declara canónica, versiones por idioma e imagen para compartir", async ({
    page,
    request,
  }) => {
    await page.goto("/casas");
    const head = page.locator("head");
    await expect(head.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/casas$/);
    await expect(head.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      "href",
      /\/en\/homes$/,
    );
    await expect(head.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
      "href",
      /\/casas$/,
    );
    await expect(head.locator('meta[property="og:title"]')).toHaveAttribute("content", /.+/);

    const image = await head.locator('meta[property="og:image"]').first().getAttribute("content");
    expect(image).toBeTruthy();
    const response = await request.get(new URL(image!).pathname);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  });

  test("sitemap.xml lista las páginas públicas con su versión en inglés", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const xml = await response.text();
    for (const path of ["/casas", "/construir", "/construir/nuevo", "/calculadora", "/legal/privacidad"]) {
      expect(xml).toMatch(new RegExp(`<loc>[^<]*${path}</loc>`));
    }
    expect(xml).toContain('hreflang="en"');
    expect(xml).toContain("/casas/casa-copan-choloma</loc>");
    // Las rutas privadas nunca van al sitemap.
    expect(xml).not.toMatch(/proyecto\/|cotizacion\/|portal/);
  });

  test("robots.txt bloquea todo mientras el sitio no se indexa", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    expect(await response.text()).toMatch(/Disallow: \/\s*$/m);
  });

  test("las preguntas frecuentes publican datos estructurados válidos", async ({ page }) => {
    await page.goto("/preguntas-frecuentes");
    const json = await page.locator('script[type="application/ld+json"]').first().textContent();
    const data = JSON.parse(json ?? "{}") as { "@type"?: string; mainEntity?: unknown[] };
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity?.length).toBeGreaterThan(3);
  });
});
