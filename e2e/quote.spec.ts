import { expect, horizontalOverflow, test, visibleHeading, waitForHumanDelay } from "./fixtures";

/**
 * Criterio de éxito de la Fase 1: cotizar y dejar los datos en menos de 3 minutos desde el
 * celular. Aquí lo hace un robot, así que el límite real es mucho menor; lo que se comprueba
 * es que el camino completo funcione sin errores.
 */
test.describe("cotizador", () => {
  test("cotiza una casa en terreno propio y la guarda con enlace privado", async ({ page }) => {
    const started = Date.now();
    await page.goto("/construir/cotizador");
    await expect(visibleHeading(page)).toHaveText("Cotiza tu casa");

    // 1. Terreno. El cotizador ya está montado: desde aquí cuenta el tiempo mínimo anti-bots.
    await page.getByText("Sí, ya tengo terreno").click();
    const mounted = Date.now();
    await page.getByRole("button", { name: "Siguiente" }).click();

    // 2. Ubicación
    await page.getByLabel("Departamento").selectOption({ label: "Cortés" });
    await page.getByLabel("Municipio").selectOption({ label: "Choloma" });
    await page.getByLabel("Tamaño de tu terreno (opcional)").fill("300");
    await page.getByText("Varas cuadradas").click();
    await page.getByRole("button", { name: "Siguiente" }).click();

    // 3. Diseño, 4. acabados (estándar por defecto), 5. extras
    await page.getByText("Modelo Copán").click();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await page.getByText("Cisterna de 5,000 litros").click();
    await page.getByRole("button", { name: "Ver mi cotización" }).click();

    // 6. Resultado: total, pago inicial y plan por etapas, en dólares y lempiras.
    await expect(page.getByText("Total estimado de tu casa")).toBeVisible();
    await expect(page.getByText(/Pago inicial \(\d+ %\)/).first()).toBeVisible();
    await expect(page.getByText(/^\$[\d,]+$/).first()).toBeVisible();
    await expect(page.getByText(/L [\d,]+/).first()).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    // 7. Datos de contacto
    await page.getByRole("button", { name: "Guardar y recibirla por correo" }).click();
    await page.getByLabel("Nombre completo").fill("María Hernández");
    await page.getByLabel("Correo electrónico").fill(`maria.${Date.now()}@example.com`);
    await page.getByLabel("Teléfono o WhatsApp").fill("+1 305 555 0123");
    await page.locator('input[name="privacy"]').check();
    await waitForHumanDelay(page, mounted);
    await page.getByRole("button", { name: "Guardar mi cotización" }).click();

    // Página privada de la cotización
    await page.waitForURL(/\/cotizacion\/[A-Za-z0-9_-]{43}$/);
    await expect(visibleHeading(page)).toHaveText("Hola, María. Esta es tu cotización");
    await expect(page.getByText("Modelo Copán").first()).toBeVisible();
    await expect(page.getByText(/Cotización CF-/).first()).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    expect(Date.now() - started).toBeLessThan(180_000);
  });

  test("la cotización privada no se cachea y lleva la CSP estricta", async ({ page, request }) => {
    // Un enlace con formato válido pero inexistente: se responde igual que una ruta desconocida.
    page.removeAllListeners("console");
    const token = "A".repeat(43);
    const response = await request.get(`/cotizacion/${token}`);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["content-security-policy"]).toContain("'strict-dynamic'");

    await page.goto(`/cotizacion/${token}`);
    await expect(visibleHeading(page)).toHaveText("No encontramos esta página");
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  });

  test("desde la ficha de un terreno el cotizador llega con el terreno elegido", async ({ page }) => {
    await page.goto("/terrenos/terreno-choloma");
    await page.getByRole("link", { name: "Comprar terreno + construir mi casa" }).click();
    await expect(page).toHaveURL(/\/construir\/cotizador\?lot=terreno-choloma/);
    await expect(page.getByLabel("No, quiero comprar uno de ustedes")).toBeChecked();
  });

  test("funciona en inglés con las rutas traducidas", async ({ page }) => {
    await page.goto("/en/build/quote");
    await expect(visibleHeading(page)).toHaveText("Get a quote for your home");
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
  });
});
