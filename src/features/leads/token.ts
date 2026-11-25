import { createHash, randomBytes } from "node:crypto";

/**
 * Enlace privado de una cotización. El token va en la URL y se envía por correo; en la
 * base solo queda su SHA-256. 32 bytes aleatorios: imposible de adivinar.
 */
export const QUOTE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function newQuoteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashQuoteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isWellFormedQuoteToken(token: string): boolean {
  return QUOTE_TOKEN_PATTERN.test(token);
}
