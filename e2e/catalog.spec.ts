import { expect, horizontalOverflow, test, visibleHeading } from "./fixtures";

/** "12 casas" → 12 */
async function resultCount(text: Promise<string>): Promise<number> {
  return Number(/\d+/.exec(await text)?.[0] ?? Number.NaN);
}

test.describe("catálogo", () => {
  test("los filtros de casas cambian los resultados y quedan en la URL", async ({ page }) => {
    await page.goto("/casas");
    await expect(visibleHeading(page)).toHaveText("Casas listas");
    const counter = page.getByText(/^\d+ casas?$|^Ninguna casa$/);
    const total = await resultCount(counter.innerText());
    expect(total).toBeGreaterThan(1);

    // En el celular los filtros empiezan plegados.
    const summary = page.getByText(/^Filtros/);
    const details = page.locator("details").filter({ has: summary });
    if (!(await details.evaluate((element: HTMLDetailsElement) => element.open))) await summary.click();

    await page.getByLabel("Departamento").selectOption({ label: "Atlántida" });
    await page.getByRole("button", { name: "Ver resultados" }).click();
    await expect(page).toHaveURL(/department=/);
    await expect.poll(() => resultCount(counter.innerText())).toBeLessThan(total);
    for (const place of await page
      .locator("ul li")
      .getByText(/, (Cortés|Francisco Morazán|Comayagua)$/)
      .all()) {
      await expect(place).toBeHidden();
    }
  });

  test("sin resultados muestra el estado vacío con salida por WhatsApp", async ({ page }) => {
    await page.goto("/casas?minPrice=9000000");
    await expect(page.getByText("No encontramos casas con esos filtros")).toBeVisible();
    await expect(page.getByRole("link", { name: "Contarnos por WhatsApp qué buscas" })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\//,
    );
    // Hay dos enlaces iguales: uno en los filtros y otro en el estado vacío.
    await page.getByRole("link", { name: "Quitar filtros" }).last().click();
    await expect(page).toHaveURL(/\/casas$/);
  });

  test("la vista de mapa muestra los terrenos y enlaza a cada ficha", async ({ page }) => {
    await page.goto("/terrenos");
    await page.getByRole("link", { name: "Mapa" }).click();
    await expect(page).toHaveURL(/view=map/);

    const map = page.getByRole("region", { name: "Mapa de terrenos" });
    await expect(map).toBeVisible();
    const markers = map.locator(".leaflet-marker-icon");
    await expect(markers.first()).toBeVisible();
    expect(await markers.count()).toBeGreaterThan(1);

    await markers.first().click();
    const link = map.getByRole("link", { name: "Ver ficha" });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/terrenos\/[a-z0-9-]+$/);
  });

  test("la ficha de una casa muestra precio en dólares y lempiras, plano y documentos", async ({ page }) => {
    await page.goto("/casas/casa-copan-choloma");
    await expect(visibleHeading(page)).toBeVisible();
    await expect(page.getByText(/^\$[\d,]+$/).first()).toBeVisible();
    await expect(page.getByText(/L [\d,]+/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Plano" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Documentos que te mostramos antes de cualquier pago" }),
    ).toBeVisible();
    await expect(page.getByText("Ejemplo").first()).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test("una ficha que no existe responde 404 en las tres secciones y los dos idiomas", async ({ page }) => {
    // El proxy manda los slugs no publicados a un 404 fijo: así no se genera ni se guarda una
    // página por cada URL inventada (ISR).
    page.removeAllListeners("console");
    const suffix = Date.now();
    for (const path of [
      `/casas/no-existe-${suffix}`,
      `/en/homes/no-existe-${suffix}`,
      `/terrenos/no-existe-${suffix}`,
      `/construir/modelos/no-existe-${suffix}`,
      `/en/build/models/no-existe-${suffix}`,
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(visibleHeading(page), path).toHaveText(
        path.startsWith("/en/") ? "We can't find this page" : "No encontramos esta página",
      );
    }
  });

  test("los modelos llevan al cotizador con el modelo elegido", async ({ page }) => {
    await page.goto("/construir/modelos/modelo-copan");
    await expect(visibleHeading(page)).toContainText("Copán");
    await page
      .getByRole("link", { name: /Cotizar/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/construir\/cotizador\?model=modelo-copan/);
  });
});
