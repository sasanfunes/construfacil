import type { Page } from "@playwright/test";

import { expect, horizontalOverflow, test, visibleHeading, waitForHumanDelay } from "./fixtures";

/**
 * Construir: crear un proyecto (onboarding), guardarlo y usar su panel privado. Criterio
 * de éxito: el camino completo en el celular, en mucho menos de 3 minutos y sin errores.
 */

async function next(page: Page) {
  await page.getByRole("button", { name: /^(Siguiente|Ver mi proyecto|Guardar mi proyecto)$/ }).click();
}

async function createProject(page: Page): Promise<string> {
  await page.goto("/construir");
  await page.getByRole("link", { name: "Crear mi proyecto" }).first().click();
  await expect(page).toHaveURL(/\/construir\/nuevo$/);

  await page.getByLabel("Nombre del proyecto").fill("Casa de mamá en Choloma");
  await next(page);
  const mounted = Date.now();
  await page.getByText("Sí, ya tengo terreno").click();
  await next(page);
  await page.getByLabel("Departamento").selectOption({ label: "Cortés" });
  await page.getByLabel("Municipio").selectOption({ label: "Choloma" });
  await page.getByLabel("Tamaño del terreno (opcional)").fill("300");
  await next(page);
  await page.getByText("No tengo planos", { exact: true }).click();
  await next(page);
  await page.getByText("Elegir un modelo del catálogo", { exact: true }).click();
  await next(page);
  await page.getByLabel("Modelo Copán").check();
  await next(page);

  // Cimentación, obra gris, techos y acabados
  await expect(page.getByText("Etapa 1 de 4")).toBeVisible();
  await page.getByText("Steel framing", { exact: true }).click();
  await next(page);
  await page.getByText("Sistema poliestireno", { exact: true }).click();
  await next(page);
  await next(page);
  await page.getByText("Porcelanato", { exact: true }).click();
  await next(page);

  // Resumen
  await expect(visibleHeading(page)).toBeVisible();
  await expect(page.getByText("Diseño, trámites y obra").first()).toBeVisible();
  await expect(page.getByText("Pago inicial: diseño y trámites")).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  await next(page);

  // Guardar
  await page.getByLabel("Nombre completo").fill("María Hernández");
  await page
    .getByLabel("Correo electrónico")
    .fill(`maria.${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`);
  await page.getByLabel("Teléfono o WhatsApp").fill("+1 305 555 0123");
  await page.locator('input[name="privacy"]').check();
  await waitForHumanDelay(page, mounted);
  await page.getByRole("button", { name: "Guardar mi proyecto" }).click();
  await page.waitForURL(/\/proyecto\/[A-Za-z0-9_-]{43}$/);
  return page.url();
}

test.describe("construir", () => {
  test("crea un proyecto en el onboarding y llega a su panel privado", async ({ page }) => {
    const started = Date.now();
    await createProject(page);
    await expect(page.getByRole("heading", { level: 1, name: "Casa de mamá en Choloma" })).toBeVisible();
    await expect(page.getByText(/Proyecto CF-P-[0-9A-F]{6}/)).toBeVisible();
    await expect(page.getByText("Hola, María")).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    expect(Date.now() - started).toBeLessThan(180_000);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("en el panel se cambian materiales y se piden servicios", async ({ page }) => {
    await createProject(page);
    const total = page.locator("#materiales h3", { hasText: "Cimentación" }).locator("..");
    const before = await total.innerText();
    await page.getByText("Concreto reforzado", { exact: true }).click();
    await expect(page.getByText("Cambios guardados")).toBeVisible();
    await expect(total).not.toHaveText(before);

    // Al recargar, el cambio sigue ahí (lo guardó el servidor).
    await page.reload();
    await expect(page.getByRole("radio", { name: /Concreto reforzado/ })).toBeChecked();

    await page.getByLabel("Una prueba de avance").check();
    await page.getByLabel("Cuéntanos más (opcional)").fill("Quiero ver fotos del terreno.");
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page.getByText("¡Listo! Recibimos tu solicitud")).toBeVisible();
  });

  test("el panel no se cachea, lleva la CSP estricta y no se indexa", async ({ page, request }) => {
    const url = await createProject(page);
    const response = await request.get(new URL(url).pathname);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["content-security-policy"]).toContain("'strict-dynamic'");
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  });

  test("un enlace de proyecto que no existe muestra el 404", async ({ page }) => {
    page.removeAllListeners("console");
    await page.goto(`/proyecto/${"A".repeat(43)}`);
    await expect(visibleHeading(page)).toHaveText("No encontramos esta página");
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  });

  test("sin terreno: elige uno del catálogo y lo ve en el resumen", async ({ page }) => {
    await page.goto("/construir/nuevo");
    await page.getByLabel("Nombre del proyecto").fill("Mi casa en Villanueva");
    await next(page);
    await page.getByText("No, quiero comprar uno").click();
    await next(page);
    await page.getByLabel("Departamento").selectOption({ label: "Cortés" });
    await page.getByRole("radio").first().check();
    await next(page);
    await page.getByText("Diseñar desde cero", { exact: true }).click();
    await next(page);
    await page.getByLabel(/Metros de construcción/).fill("120");
    await next(page);
    await page.getByText("2 plantas").click();
    await next(page);
    await expect(page.getByText("Entrepiso (piso de la planta alta)")).toBeVisible();
    await next(page);
    await next(page);
    await next(page);
    await expect(page.getByText("Terreno (se paga aparte)")).toBeVisible();
  });

  test("las direcciones viejas de terrenos, materiales y cotizador llevan a Construir", async ({ page }) => {
    await page.goto("/terrenos/terreno-choloma");
    await expect(page).toHaveURL(/\/construir\/nuevo\?lot=terreno-choloma$/);
    await page.goto("/materiales");
    await expect(page).toHaveURL(/\/construir$/);
    await page.goto("/construir/cotizador?model=modelo-copan");
    await expect(page).toHaveURL(/\/construir\/nuevo\?model=modelo-copan$/);
  });

  test("funciona en inglés con las rutas traducidas", async ({ page }) => {
    await page.goto("/en/build/new");
    await expect(visibleHeading(page)).toHaveText("Start my project");
    await expect(page.getByLabel("Project name")).toBeVisible();
  });
});
