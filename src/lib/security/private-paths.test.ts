import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { routing } from "@/i18n/routing";

import { isPrivatePath, isSuspiciousPath } from "./private-paths";

const locales = ["es", "en"];

describe("isPrivatePath", () => {
  it.each([
    "/portal",
    "/portal/proyectos/123",
    "/portal/contrato.pdf",
    "/admin",
    "/admin/leads",
    "/ingresar",
    "/cuenta",
    "/invitacion/abc",
    "/auth/callback",
    "/cotizacion/tok_123",
    "/checkout",
  ])("%s es privada", (route) => expect(isPrivatePath(route, locales)).toBe(true));

  it.each([
    "/en/portal",
    "/en/admin/users",
    "/en/sign-in",
    "/en/account",
    "/en/invitation/abc",
    "/en/quote/tok_123",
    "/es/portal",
    "/PORTAL",
    "/EN/Portal",
    "//portal",
  ])("%s es privada (con prefijo de idioma, mayúsculas o barras de más)", (route) =>
    expect(isPrivatePath(route, locales)).toBe(true),
  );

  it.each(["/%70ortal", "/en/%61dmin", "/portal%2Fproyectos"])(
    "%s es privada aunque venga codificada",
    (route) => expect(isPrivatePath(route, locales)).toBe(true),
  );

  it.each([
    "/",
    "/en",
    "/casas",
    "/en/homes",
    "/casas/portal",
    "/construir/cotizador",
    "/en/build/quote",
    "/portales",
    "/administracion",
  ])("%s es pública", (route) => expect(isPrivatePath(route, locales)).toBe(false));
});

describe("isSuspiciousPath", () => {
  // Rutas que el enrutador de idiomas "limpiaría" hasta convertirlas en /portal.
  it.each([
    "/por%09tal",
    "/en/por%0Atal",
    "/%0d%0aportal",
    "/e%09n/portal",
    "/en/%09/portal",
    "/en/portal%20",
    "/en/portal%00",
    "/%20portal",
    "/en%5Cportal",
    "/portal%7F",
    "/%zz",
    "/%E0%A4%A",
  ])("%s se rechaza", (route) => expect(isSuspiciousPath(route)).toBe(true));

  it.each([
    "/",
    "/en",
    "/casas/casa-en-san-pedro-sula",
    "/casas/casa%20bonita",
    "/guias/qué-es-un-poder",
    "/portal/a.b.c",
  ])("%s es una ruta normal", (route) => expect(isSuspiciousPath(route)).toBe(false));
});

/**
 * Red de seguridad: ninguna carpeta de `src/app/[locale]` puede quedar sin clasificar.
 * Lo público vive dentro de `(public)`; todo lo demás debe estar en PRIVATE_SEGMENTS,
 * con su nombre interno y con su traducción en cada idioma.
 */
describe("clasificación de las rutas que existen", () => {
  const localeDir = path.resolve(import.meta.dirname, "../../app/[locale]");
  const dirs = (dir: string) =>
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

  const localizedNames = (segment: string): string[] => {
    const names = new Set([segment]);
    for (const [internal, external] of Object.entries(routing.pathnames)) {
      if (internal.split("/")[1] !== segment) continue;
      const variants =
        typeof external === "string" ? [external] : Object.values(external as Record<string, string>);
      for (const variant of variants) {
        const first = variant.split("/")[1];
        if (first) names.add(first);
      }
    }
    return [...names];
  };

  const topLevel = dirs(localeDir).filter((name) => !name.startsWith("(") && !name.startsWith("["));
  const publicSegments = dirs(path.join(localeDir, "(public)")).filter(
    (name) => !name.startsWith("(") && !name.startsWith("["),
  );

  it("toda carpeta fuera de (public) es privada en todos los idiomas", () => {
    expect(topLevel.length).toBeGreaterThan(0);
    for (const segment of topLevel) {
      for (const name of localizedNames(segment)) {
        expect(isPrivatePath(`/${name}`, locales), `/${name} debe estar en PRIVATE_SEGMENTS`).toBe(true);
        expect(isPrivatePath(`/en/${name}`, locales), `/en/${name}`).toBe(true);
      }
    }
  });

  it("ninguna carpeta dentro de (public) choca con un segmento privado", () => {
    for (const segment of publicSegments) {
      for (const name of localizedNames(segment)) {
        expect(
          isPrivatePath(`/${name}`, locales),
          `/${name} está en (public) pero se clasifica como privada`,
        ).toBe(false);
      }
    }
  });
});
