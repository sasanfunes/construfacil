import { describe, expect, it } from "vitest";

import { projectNameError } from "./names";
import { projectInputSchema, projectNameSchema, projectRequestSchema } from "./schemas";

const NAMES: Array<[string, ReturnType<typeof projectNameError>]> = [
  ["Casa de mamá en Choloma", null],
  ["  Casa   nueva  ", null],
  ["Ñandú #2 (lote 4)", null],
  ["A", "nameTooShort"],
  ["   ", "nameTooShort"],
  ["x".repeat(81), "nameTooLong"],
  ["casa.com", "projectNameInvalid"],
  ["https://ejemplo", "projectNameInvalid"],
  ["mi@correo", "projectNameInvalid"],
  ["-casa", "projectNameInvalid"],
];

describe("nombre del proyecto", () => {
  it.each(NAMES)("%j → %s", (name, expected) => {
    expect(projectNameError(name)).toBe(expected);
  });

  it("el esquema del servidor aplica la misma regla que el navegador", () => {
    for (const [name, expected] of NAMES) {
      const parsed = projectNameSchema.safeParse(name);
      expect(parsed.success ? null : parsed.error.issues[0]?.message, name).toBe(expected);
    }
    expect(projectNameSchema.safeParse(42).success).toBe(false);
  });

  it("guarda el nombre sin espacios sobrantes", () => {
    expect(projectNameSchema.parse("  Casa   nueva ")).toBe("Casa nueva");
  });
});

describe("datos del onboarding", () => {
  const valid = {
    landStatus: "own",
    lotId: null,
    departmentId: 5,
    municipalityId: null,
    landAreaM2: 300,
    designSource: "custom",
    houseModelId: null,
    areaM2: 120,
    floors: 1,
    bedrooms: 3,
    bathrooms: 2,
    optionIds: ["5f0c6c1e-8a51-4a5e-9a59-0d0f4f5b1c11"],
  };

  it("acepta solo identificadores y números", () => {
    expect(projectInputSchema.safeParse(valid).success).toBe(true);
  });

  it("descarta montos que lleguen del navegador", () => {
    const parsed = projectInputSchema.parse({ ...valid, totalUsdCents: 1 });
    expect(parsed).not.toHaveProperty("totalUsdCents");
  });

  it("rechaza pisos, áreas y listas fuera de rango", () => {
    for (const change of [
      { floors: 3 },
      { areaM2: 5 },
      { bathrooms: 0 },
      { optionIds: [] },
      { lotId: "x" },
    ]) {
      expect(projectInputSchema.safeParse({ ...valid, ...change }).success, JSON.stringify(change)).toBe(
        false,
      );
    }
  });
});

describe("pedidos desde el panel", () => {
  const token = "a".repeat(43);

  it("acepta los tipos conocidos y trata el mensaje vacío como ausente", () => {
    const parsed = projectRequestSchema.parse({ locale: "es", token, kind: "support", message: "  " });
    expect(parsed.message).toBeNull();
  });

  it("rechaza tipos desconocidos, enlaces mal formados y mensajes largos", () => {
    for (const change of [{ kind: "refund" }, { token: "corto" }, { message: "x".repeat(1001) }]) {
      const input = { locale: "es", token, kind: "service", message: null, ...change };
      expect(projectRequestSchema.safeParse(input).success, JSON.stringify(change)).toBe(false);
    }
  });
});
