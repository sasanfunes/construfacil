import { describe, expect, it } from "vitest";

import { listedHomes, listedLots } from "./catalog";
import {
  activeFilterCount,
  filterHomes,
  filterLots,
  parseHomeFilters,
  parseLotFilters,
  toSearchParams,
} from "./filters";
import { SAMPLE_CATALOG } from "./sample";

const homes = listedHomes(SAMPLE_CATALOG);
const lots = listedLots(SAMPLE_CATALOG);

describe("parseHomeFilters", () => {
  it("lee los filtros válidos", () => {
    expect(
      parseHomeFilters({
        department: "5",
        city: "1",
        minPrice: "30000",
        maxPrice: "80000",
        beds: "3",
        baths: "2",
        status: "ready",
        minArea: "80",
        view: "map",
      }),
    ).toEqual({
      department: 5,
      city: 1,
      minPrice: 30_000,
      maxPrice: 80_000,
      beds: 3,
      baths: 2,
      status: "ready",
      minArea: 80,
      view: "map",
    });
  });

  it("ignora valores inválidos en vez de fallar", () => {
    expect(
      parseHomeFilters({
        department: "cinco",
        minPrice: "-10",
        beds: "99",
        status: "demolida",
        view: "satelite",
        maxPrice: "<script>",
      }),
    ).toEqual({ view: "list" });
  });

  it("toma el primer valor si viene repetido y descarta los vacíos", () => {
    expect(parseHomeFilters({ beds: ["2", "4"], baths: "", department: "  " })).toEqual({
      beds: 2,
      view: "list",
    });
  });
});

describe("filterHomes", () => {
  it("sin filtros muestra todas las publicadas y apartadas", () => {
    expect(filterHomes(homes, { view: "list" })).toHaveLength(12);
  });

  it("filtra por departamento, cuartos, estado y precio", () => {
    const result = filterHomes(homes, {
      department: 5,
      beds: 3,
      status: "ready",
      maxPrice: 60_000,
      view: "list",
    });
    expect(result.map((h) => h.slug)).toEqual(["casa-copan-choloma", "casa-puerto-cortes", "casa-la-lima"]);
  });

  it("un precio máximo de 0 no filtra", () => {
    expect(filterHomes(homes, { maxPrice: 0, view: "list" })).toHaveLength(12);
  });

  it("filtra por municipio y por superficie mínima", () => {
    expect(filterHomes(homes, { city: 1, view: "list" }).every((h) => h.municipalityId === 1)).toBe(true);
    expect(filterHomes(homes, { minArea: 140, view: "list" }).every((h) => h.constructionAreaM2 >= 140)).toBe(
      true,
    );
  });
});

describe("filterLots", () => {
  it("filtra por servicios y escritura en regla", () => {
    const result = filterLots(lots, {
      water: true,
      sewer: true,
      paved: true,
      clearTitle: true,
      view: "list",
    });
    expect(result.length).toBeGreaterThan(0);
    for (const lot of result) {
      expect(lot).toMatchObject({
        hasWater: true,
        hasSewer: true,
        roadAccess: "paved",
        legalStatus: "full_title",
      });
    }
  });

  it("lee las casillas marcadas", () => {
    expect(parseLotFilters({ water: "on", electricity: "1", clearTitle: "nope" })).toEqual({
      water: true,
      electricity: true,
      view: "list",
    });
  });
});

describe("utilidades", () => {
  it("cuenta los filtros activos sin la vista", () => {
    expect(activeFilterCount({ department: 5, beds: 2, view: "map" })).toBe(2);
  });

  it("arma la URL de vuelta, cambiando solo lo indicado", () => {
    expect(toSearchParams({ department: 5, water: true, view: "list" }, { view: "map" }).toString()).toBe(
      "department=5&water=1&view=map",
    );
    expect(toSearchParams({ department: 5, view: "map" }, { view: "list" }).toString()).toBe("department=5");
  });
});
