import { test as base, expect, type Page } from "@playwright/test";

/** PNG transparente de 1×1: reemplaza los mosaicos del mapa para no depender de internet. */
const BLANK_TILE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/** IP de documentación al azar (198.18.0.0/15) para que cada prueba tenga su propio límite. */
function randomTestIp(): string {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  return `198.${18 + Math.floor(Math.random() * 2)}.${octet()}.${octet()}`;
}

/**
 * - Toda prueba falla si la página escribe un error en consola. Así se detectan violaciones de
 *   CSP, errores de hidratación y recursos que no cargan.
 * - Cada prueba llega desde una IP distinta: los formularios tienen rate limiting por IP y las
 *   pruebas corren en paralelo contra el mismo servidor.
 * - Los mosaicos de OpenStreetMap se sirven en blanco desde aquí.
 */
export const test = base.extend<{ consoleErrors: string[]; clientIp: string }>({
  clientIp: [
    async ({ page }, use) => {
      const ip = randomTestIp();
      await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
      await page.route("https://tile.openstreetmap.org/**", (route) =>
        route.fulfill({ status: 200, contentType: "image/png", body: BLANK_TILE }),
      );
      await use(ip);
    },
    { auto: true },
  ],
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await use(errors);
      expect(errors, "La página no debe registrar errores en consola").toEqual([]);
    },
    { auto: true },
  ],
});

/** Ancho que sobra a la derecha: debe ser 0 en todas las páginas (sin scroll horizontal). */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/**
 * Los formularios descartan en silencio los envíos hechos menos de 3 segundos después de
 * mostrarse (bots). Las pruebas esperan ese tiempo antes de enviar: se mide desde el campo
 * oculto `startedAt` del formulario o, si no lo hay (cotizador), desde `since`.
 */
export async function waitForHumanDelay(page: Page, since?: number): Promise<void> {
  const field = page.locator('input[name="startedAt"]').first();
  let started = since ?? Date.now();
  if ((await field.count()) > 0) {
    await expect(field).not.toHaveValue("0");
    started = Number(await field.inputValue());
  }
  const wait = started + 3_300 - Date.now();
  if (wait > 0) await page.waitForTimeout(wait);
}

/** El título visible: con la navegación del cliente, React deja la página anterior oculta en el DOM. */
export function visibleHeading(page: Page) {
  return page.locator("h1:visible");
}

export { expect };
