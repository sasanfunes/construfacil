import { describe, expect, it } from "vitest";

import { isPrivatePath } from "./private-paths";

const locales = ["es", "en"];

describe("isPrivatePath", () => {
  it.each([
    "/portal",
    "/portal/proyectos/123",
    "/admin",
    "/admin/leads",
    "/ingresar",
    "/invitacion/abc",
    "/auth/callback",
  ])("%s es privada", (path) => expect(isPrivatePath(path, locales)).toBe(true));

  it.each(["/en/portal", "/en/admin/users", "/en/sign-in", "/en/invitation/abc", "/es/portal", "/PORTAL"])(
    "%s es privada (con prefijo de idioma o mayúsculas)",
    (path) => expect(isPrivatePath(path, locales)).toBe(true),
  );

  it.each(["/%70ortal", "/en/%61dmin", "/portal%2Fproyectos"])(
    "%s es privada aunque venga codificada",
    (path) => expect(isPrivatePath(path, locales)).toBe(true),
  );

  it("no falla con una ruta mal codificada", () => {
    expect(isPrivatePath("/%E0%A4%A", locales)).toBe(false);
  });

  it.each([
    "/",
    "/en",
    "/casas",
    "/en/homes",
    "/casas/portal",
    "/construir/cotizador",
    "/portales",
    "/administracion",
  ])("%s es pública", (path) => expect(isPrivatePath(path, locales)).toBe(false));
});
