/**
 * Clasificación de rutas para la CSP.
 *
 * Las rutas privadas reciben la CSP estricta con nonce y nunca se sirven desde caché.
 * Aquí va el primer segmento de cada una, en todos los idiomas. Una ruta privada nueva
 * se agrega a esta lista; `private-paths.test.ts` falla si una carpeta de
 * `src/app/[locale]` queda sin clasificar.
 */
export const PRIVATE_SEGMENTS: ReadonlySet<string> = new Set([
  // Portal del cliente y panel interno
  "portal",
  "admin",
  // Acceso y cuenta
  "ingresar",
  "sign-in",
  "auth",
  "cuenta",
  "account",
  "invitacion",
  "invitation",
  // Páginas con datos personales o de pago (llegan en las fases 1 y 3)
  "cotizacion",
  "quote",
  "checkout",
]);

function safeDecode(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

/**
 * Rutas que ningún enlace legítimo produce: codificación rota, caracteres de control,
 * barras invertidas o espacios al borde de un segmento. El enrutador de idiomas las
 * "limpia" antes de servirlas (p. ej. `/por%09tal` termina en `/portal`), lo que
 * permitiría esquivar la clasificación de abajo. Se rechazan antes de llegar ahí.
 */
export function isSuspiciousPath(pathname: string): boolean {
  const decoded = safeDecode(pathname);
  if (decoded === null) return true;
  if (/[\u0000-\u001f\u007f\\]/.test(decoded)) return true;
  return decoded.split("/").some((segment) => segment !== segment.trim());
}

export function isPrivatePath(pathname: string, locales: readonly string[]): boolean {
  // Se decodifica primero: `/%70ortal` llega a la misma página que `/portal`.
  const segments = (safeDecode(pathname) ?? pathname)
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
  const first = segments[0];
  if (first === undefined) return false;
  const section = locales.includes(first) ? segments[1] : first;
  return section !== undefined && PRIVATE_SEGMENTS.has(section);
}
