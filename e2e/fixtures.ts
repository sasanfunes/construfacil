import { test as base, expect } from "@playwright/test";

/**
 * Toda prueba falla si la página escribe un error en consola. Así se detectan
 * violaciones de CSP, errores de hidratación y recursos que no cargan.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
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

export { expect };
