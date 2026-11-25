/**
 * Defensa básica contra bots en formularios públicos, además del rate limiting:
 * - Campo trampa: un input oculto que una persona nunca llena.
 * - Tiempo mínimo: nadie llena un formulario en menos de 3 segundos.
 * A un bot no se le dice que fue detectado: recibe una respuesta de éxito y no se guarda nada.
 */
export const HONEYPOT_FIELD = "website";
export const STARTED_AT_FIELD = "startedAt";
export const MIN_FILL_MS = 3_000;

export function looksLikeBot({
  honeypot,
  startedAt,
  now,
}: {
  honeypot: unknown;
  startedAt: unknown;
  now: number;
}): boolean {
  if (typeof honeypot === "string" && honeypot.trim() !== "") return true;
  const started = typeof startedAt === "number" ? startedAt : Number(startedAt);
  if (!Number.isFinite(started)) return true;
  if (started > now + 60_000) return true; // reloj imposible
  return now - started < MIN_FILL_MS;
}
