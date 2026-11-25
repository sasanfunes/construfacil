import { describe, expect, it } from "vitest";

import { hasAnyRole, isStaffRole, isUserRole, STAFF_ROLES, USER_ROLES } from "./roles";

describe("roles", () => {
  it("son exactamente los seis del brief", () => {
    expect([...USER_ROLES].sort()).toEqual(
      ["admin", "cliente", "familiar_autorizado", "gerente_proyecto", "logistica", "ventas"].sort(),
    );
  });

  it("cliente y familiar no son equipo", () => {
    expect(isStaffRole("cliente")).toBe(false);
    expect(isStaffRole("familiar_autorizado")).toBe(false);
    expect(isStaffRole(null)).toBe(false);
    for (const role of STAFF_ROLES) expect(isStaffRole(role)).toBe(true);
  });

  it("valida valores desconocidos", () => {
    expect(isUserRole("admin")).toBe(true);
    expect(isUserRole("superadmin")).toBe(false);
    expect(isUserRole(undefined)).toBe(false);
  });

  it("hasAnyRole niega cuando no hay rol", () => {
    expect(hasAnyRole("ventas", ["ventas", "admin"])).toBe(true);
    expect(hasAnyRole("cliente", ["ventas", "admin"])).toBe(false);
    expect(hasAnyRole(undefined, ["admin"])).toBe(false);
  });
});
