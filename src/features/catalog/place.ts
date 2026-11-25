import type { Catalog } from "./catalog";

/** Nombres del municipio y del departamento de una casa o terreno. */
export function placeOf(
  catalog: Pick<Catalog, "departments" | "municipalities">,
  item: { departmentId: number; municipalityId: number },
) {
  return {
    municipality: catalog.municipalities.find((m) => m.id === item.municipalityId)?.name ?? "",
    department: catalog.departments.find((d) => d.id === item.departmentId)?.name ?? "",
  };
}
