/**
 * Regla del nombre del proyecto ("Casa de mamá en Choloma"), sin dependencias: el onboarding la
 * usa en el navegador y `projectNameSchema` la aplica en el servidor, que es la que cuenta.
 *
 * El nombre va en el correo de confirmación, así que no admite caracteres para armar enlaces
 * (punto, barra, dos puntos, arroba): nadie puede usar nuestros correos para mandar una URL a la
 * dirección de otra persona.
 */
export const PROJECT_NAME_PATTERN = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '’,#()-]*$/u;
export const PROJECT_NAME_MIN = 2;
export const PROJECT_NAME_MAX = 80;

export type ProjectNameError = "required" | "nameTooShort" | "nameTooLong" | "projectNameInvalid";

/** Quita espacios de los extremos y junta los repetidos. */
export function normalizeProjectName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** La llave de error de `forms.errors`, o null si el nombre sirve. */
export function projectNameError(raw: unknown): ProjectNameError | null {
  if (typeof raw !== "string") return "required";
  const name = normalizeProjectName(raw);
  if (name.length < PROJECT_NAME_MIN) return "nameTooShort";
  if (name.length > PROJECT_NAME_MAX) return "nameTooLong";
  if (!PROJECT_NAME_PATTERN.test(name)) return "projectNameInvalid";
  return null;
}
