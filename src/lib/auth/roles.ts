import type { Enums } from "@/lib/supabase/database.types";

export type UserRole = Enums<"user_role">;

export const USER_ROLES = [
  "cliente",
  "familiar_autorizado",
  "ventas",
  "gerente_proyecto",
  "logistica",
  "admin",
] as const satisfies readonly UserRole[];

/** Roles del equipo interno. Mismo criterio que `private.is_staff()` en la base. */
export const STAFF_ROLES = [
  "ventas",
  "gerente_proyecto",
  "logistica",
  "admin",
] as const satisfies readonly UserRole[];

export type StaffRole = (typeof STAFF_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export function isStaffRole(role: UserRole | null | undefined): role is StaffRole {
  return role != null && (STAFF_ROLES as readonly string[]).includes(role);
}

export function hasAnyRole(role: UserRole | null | undefined, allowed: readonly UserRole[]): boolean {
  return role != null && allowed.includes(role);
}
