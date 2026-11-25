import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DEPARTMENTS, MUNICIPALITIES, municipalityId } from "./data";

const migration = readFileSync(
  path.resolve(import.meta.dirname, "../../../supabase/migrations/20261124000200_reference_data.sql"),
  "utf8",
);

describe("geografía", () => {
  it("los departamentos coinciden con la migración", () => {
    const rows = [
      ...migration.matchAll(
        /\((\d+),\s+'(HN-[A-Z]{2})',\s+'([^']+)',\s+(true|false),\s+([\d.]+),\s+(-[\d.]+)\)/g,
      ),
    ].map(([, id, iso, name, active, lat, lng]) => ({
      id: Number(id),
      isoCode: iso,
      name,
      isActive: active === "true",
      latitude: Number(lat),
      longitude: Number(lng),
    }));
    expect(rows).toEqual(DEPARTMENTS);
  });

  it("los municipios coinciden con la migración, en el mismo orden (de ahí sale su id)", () => {
    const rows = [...migration.matchAll(/\((\d+),\s+'([^']+)',\s+([\d.]+),\s+(-[\d.]+)\)/g)].map(
      ([, departmentId, name, lat, lng], index) => ({
        id: index + 1,
        departmentId: Number(departmentId),
        name,
        latitude: Number(lat),
        longitude: Number(lng),
      }),
    );
    expect(rows).toEqual(MUNICIPALITIES);
  });

  it("los cuatro departamentos activos tienen municipios", () => {
    for (const department of DEPARTMENTS.filter((d) => d.isActive)) {
      expect(
        MUNICIPALITIES.some((m) => m.departmentId === department.id),
        department.name,
      ).toBe(true);
    }
  });

  it("municipalityId encuentra por nombre y falla con nombres desconocidos", () => {
    expect(municipalityId(5, "San Pedro Sula")).toBe(1);
    expect(() => municipalityId(5, "Gotham")).toThrow();
  });
});
