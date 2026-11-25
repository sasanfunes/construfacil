/**
 * Regla del nombre del proyecto ("Casa de mamá en Choloma"), sin dependencias: el onboarding la
 * usa en el navegador y `projectNameSchema` la aplica en el servidor, que es la que cuenta.
 *
 * El nombre se muestra en el panel al que lleva el correo de confirmación, y ese correo puede
 * llegar a una dirección que nadie ha verificado. Por eso no admite caracteres para armar enlaces
 * (punto, barra, dos puntos, arroba), letras de otros alfabetos que imitan un punto, ni más de
 * cuatro números (no cabe un teléfono): nadie puede usarlo para mandarle a otra persona un enlace
 * o un número "de contacto" con nuestro nombre.
 */
export const PROJECT_NAME_PATTERN = /^[\p{Script=Latin}0-9][\p{Script=Latin}\p{M}0-9 '’,#()-]*$/u;
export const PROJECT_NAME_MIN = 2;
export const PROJECT_NAME_MAX = 80;
export const PROJECT_NAME_MAX_DIGITS = 4;

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
  if ((name.match(/[0-9]/g)?.length ?? 0) > PROJECT_NAME_MAX_DIGITS) return "projectNameInvalid";
  return null;
}
