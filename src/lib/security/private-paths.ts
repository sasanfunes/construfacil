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

function safeDecode(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

export function isPrivatePath(pathname: string, locales: readonly string[]): boolean {
  // Se decodifica primero: `/%70ortal` llega a la misma página que `/portal`.
  const segments = safeDecode(pathname).split("/").filter(Boolean);
  const first = segments[0];
  if (first === undefined) return false;
  const section = locales.includes(first) ? segments[1] : first;
  return section !== undefined && PRIVATE_SEGMENTS.has(section.toLowerCase());
}
