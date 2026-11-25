/** Términos que se explican con <Term>. Cada uno tiene `term` y `definition` en common.glossary. */
export const GLOSSARY_TERMS = [
  "obraGris",
  "escritura",
  "poderNotarial",
  "institutoPropiedad",
  "libertadGravamen",
  "dominioUtil",
  "apartado",
  "pagoInicial",
  "cieloFalso",
  "varas",
] as const;

export type GlossaryTerm = (typeof GLOSSARY_TERMS)[number];
