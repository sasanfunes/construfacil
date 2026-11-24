import "server-only";

import type { UserRole } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

export type AuditEvent = {
  /** Quién lo hizo. `null` solo para acciones del sistema (webhooks, tareas programadas). */
  actorId: string | null;
  actorRole?: UserRole | null;
  /** Verbo en formato `entidad.accion`, p. ej. `document.download`, `payment.mark_paid`. */
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Json;
  after?: Json;
  metadata?: Json;
  ipHash?: string | null;
  userAgent?: string | null;
};

/**
 * Registra una acción sensible en `audit_log`.
 *
 * Los cambios de datos en tablas sensibles ya quedan registrados por triggers de la base.
 * Esta función es para lo que un trigger no ve: descargas de documentos, intentos
 * rechazados, acciones que vienen de Stripe.
 *
 * Si no se puede registrar, lanza un error: una acción sensible sin rastro no debe completarse.
 */
export async function logAudit(event: AuditEvent): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("audit_log").insert({
    actor_id: event.actorId,
    actor_role: event.actorRole ?? null,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    before_data: event.before ?? null,
    after_data: event.after ?? null,
    metadata: event.metadata ?? {},
    ip_hash: event.ipHash ?? null,
    user_agent: event.userAgent?.slice(0, 400) ?? null,
  });

  if (error) {
    throw new Error(`No se pudo registrar la auditoría de "${event.action}" (${error.code})`);
  }
}
