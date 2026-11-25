import { expect, test, visibleHeading, waitForHumanDelay } from "./fixtures";

const uniqueEmail = (name: string) => `${name}.${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`;

test.describe("formularios de contacto", () => {
  test("contacto: marca los errores y luego envía", async ({ page }) => {
    await page.goto("/contacto");
    await expect(visibleHeading(page)).toHaveText("Contacto");

    await waitForHumanDelay(page);
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.getByRole("alert").first()).toHaveText("Revisa los campos marcados");
    await expect(page.getByText("Escribe tu nombre completo.")).toBeVisible();
    await expect(page.getByLabel("Nombre completo")).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel("Nombre completo").fill("José Martínez");
    await page.getByLabel("Correo electrónico").fill(uniqueEmail("jose"));
    await page.getByLabel("Teléfono o WhatsApp").fill("+1 713 555 0199");
    await page.getByLabel("Mensaje", { exact: true }).fill("Busco una casa de 3 cuartos en San Pedro Sula.");
    await page.locator('input[name="privacy"]').check();
    await page.getByRole("button", { name: "Enviar mensaje" }).click();

    await expect(page.getByText("¡Listo! Recibimos tu solicitud")).toBeVisible();
  });

  test("agendar: pide el día de la videollamada y la confirma", async ({ page }) => {
    await page.goto("/agendar");
    await expect(visibleHeading(page)).toHaveText("Agenda una videollamada");

    await page.getByLabel("Nombre completo").fill("Ana López");
    await page.getByLabel("Correo electrónico").fill(uniqueEmail("ana"));
    await page.getByLabel("Teléfono o WhatsApp").fill("+1 646 555 0142");
    await page.locator('input[name="privacy"]').check();

    // Sin fecha: error en el campo de la fecha.
    await waitForHumanDelay(page);
    await page.getByRole("button", { name: "Pedir videollamada" }).click();
    await expect(page.getByText("Elige una fecha.")).toBeVisible();

    // La fecha mínima la calcula el navegador (mañana, en la zona del visitante).
    const date = page.getByLabel("Día de la videollamada");
    await expect(date).toHaveAttribute("min", /^\d{4}-\d{2}-\d{2}$/);
    await date.fill((await date.getAttribute("min")) ?? "");
    await page.getByLabel("Tarde", { exact: true }).check();
    await page.getByRole("button", { name: "Pedir videollamada" }).click();

    await expect(page.getByText("¡Listo! Recibimos tu solicitud")).toBeVisible();
  });

  test("ficha de casa: el formulario de apartado envía la solicitud", async ({ page }) => {
    await page.goto("/casas/casa-copan-choloma");
    await expect(page.getByRole("heading", { name: "Aparta esta casa" })).toBeVisible();

    await page.getByLabel("Nombre completo").fill("Carlos Reyes");
    await page.getByLabel("Correo electrónico").fill(uniqueEmail("carlos"));
    await page.getByLabel("Teléfono o WhatsApp").fill("+1 305 555 0177");
    await page.locator('input[name="privacy"]').check();
    await waitForHumanDelay(page);
    await page.getByRole("button", { name: "Quiero apartarla" }).click();

    await expect(page.getByText("¡Listo! Recibimos tu solicitud")).toBeVisible();
  });

  test("el formulario en inglés usa sus propios textos", async ({ page }) => {
    await page.goto("/en/contact");
    await expect(visibleHeading(page)).toHaveText("Contact");
    await expect(page.getByLabel("Full name")).toBeVisible();
  });
});
