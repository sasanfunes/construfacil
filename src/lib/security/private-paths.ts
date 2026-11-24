/**
 * Primer segmento de las rutas privadas, en todos los idiomas. Estas rutas reciben
 * la CSP estricta con nonce y nunca se sirven desde caché.
 */
const PRIVATE_SEGMENTS = new Set([
  "portal",
  "admin",
  "ingresar",
  "sign-in",
  "invitacion",
  "invitation",
  "auth",
]);

export function isPrivatePath(pathname: string, locales: readonly string[]): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first === undefined) return false;
  const section = locales.includes(first) ? segments[1] : first;
  return section !== undefined && PRIVATE_SEGMENTS.has(section.toLowerCase());
}
