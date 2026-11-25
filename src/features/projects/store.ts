import "server-only";

import {
  getLeadStore,
  capArray,
  firstNameOf,
  leadPayload,
  MEMORY_LIMIT,
  type NewLead,
} from "@/features/leads/store";
import type { AppLocale } from "@/i18n/routing";
import { isProductionDeploy } from "@/lib/env";
import { canWriteToSupabase } from "@/lib/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { BREAKDOWN_VERSION, projectPayload, selectionsPayload } from "./payload";
import type { ProjectEstimate, ProjectInput, ProjectRequestKind } from "./types";

/**
 * Dónde se guardan los proyectos. Con Supabase, con submit_project(),
 * update_project_selections() y submit_project_request() (cada una en una transacción).
 * Sin Supabase (solo fuera de producción), en memoria.
 *
 * El cliente entra con un enlace privado: aquí solo llega el SHA-256 del token.
 */

export const PROJECT_STATUSES = ["draft", "in_review", "active", "closed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type { ProjectRequestKind };

export type NewProject = {
  tokenHash: string;
  name: string;
  locale: AppLocale;
  /** Con la ubicación ya resuelta por el motor (la del terreno, si compra uno nuestro). */
  input: ProjectInput;
  estimate: ProjectEstimate;
  usdToHnl: number;
};

export type ProjectUpdate = Pick<NewProject, "input" | "estimate" | "usdToHnl">;

/** Lo que ve el cliente en su panel: una foto de lo que se calculó. */
export type StoredProject = {
  code: string;
  /** Solo para el servidor (avisos al equipo). Nunca se manda al navegador. */
  contact: Pick<NewLead, "fullName" | "email" | "phone" | "preferredChannel" | "usState">;
  name: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  locale: AppLocale;
  firstName: string;
  input: ProjectInput;
  estimate: ProjectEstimate;
  usdToHnl: number;
};

export interface ProjectStore {
  submitProject(lead: Omit<NewLead, "source">, project: NewProject): Promise<{ code: string }>;
  findByTokenHash(tokenHash: string): Promise<StoredProject | null>;
  /** Solo mientras el proyecto es un borrador. */
  updateSelections(tokenHash: string, update: ProjectUpdate): Promise<"updated" | "not_editable">;
  submitRequest(
    tokenHash: string,
    kind: ProjectRequestKind,
    message: string | null,
  ): Promise<"created" | "not_found">;
}

/** Postgres `no_data_found`: proyecto inexistente, vencido o que ya no es borrador. */
const NO_DATA_FOUND = "P0002";

class SupabaseProjectStore implements ProjectStore {
  private db = createSupabaseAdminClient();

  async submitProject(lead: Omit<NewLead, "source">, project: NewProject) {
    const { data, error } = await this.db.rpc("submit_project", {
      p_lead: leadPayload({ ...lead, source: "project" }),
      p_project: projectPayload(project),
      p_selections: selectionsPayload(project.estimate),
    });
    const row = data?.[0];
    if (error || !row) throw new Error(`No se pudo guardar el proyecto (${error?.code ?? "sin datos"})`);
    return { code: row.project_code };
  }

  async findByTokenHash(tokenHash: string): Promise<StoredProject | null> {
    const { data, error } = await this.db
      .from("projects")
      .select("code, name, status, created_at, updated_at, locale, breakdown, usd_to_hnl, lead_id")
      .eq("access_token_hash", tokenHash)
      .gt("access_expires_at", new Date().toISOString())
      .maybeSingle();
    if (error) throw new Error(`No se pudo leer el proyecto (${error.code})`);
    if (!data) return null;

    const breakdown = data.breakdown as {
      version?: number;
      input?: ProjectInput;
      estimate?: ProjectEstimate;
    } | null;
    if (breakdown?.version !== BREAKDOWN_VERSION || !breakdown.input || !breakdown.estimate) return null;

    const lead = await this.db
      .from("leads")
      .select("full_name, email, phone, preferred_channel, us_state")
      .eq("id", data.lead_id)
      .maybeSingle();
    return {
      code: data.code,
      contact: {
        fullName: lead.data?.full_name ?? "",
        email: lead.data?.email ?? "",
        phone: lead.data?.phone ?? null,
        preferredChannel: lead.data?.preferred_channel ?? "whatsapp",
        usState: lead.data?.us_state ?? null,
      },
      name: data.name,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      locale: data.locale === "en" ? "en" : "es",
      firstName: firstNameOf(lead.data?.full_name ?? ""),
      input: breakdown.input,
      estimate: breakdown.estimate,
      usdToHnl: Number(data.usd_to_hnl),
    };
  }

  async updateSelections(tokenHash: string, update: ProjectUpdate) {
    const { error } = await this.db.rpc("update_project_selections", {
      p_token_hash: tokenHash,
      p_project: projectPayload(update),
      p_selections: selectionsPayload(update.estimate),
    });
    if (error?.code === NO_DATA_FOUND) return "not_editable" as const;
    if (error) throw new Error(`No se pudo actualizar el proyecto (${error.code})`);
    return "updated" as const;
  }

  async submitRequest(tokenHash: string, kind: ProjectRequestKind, message: string | null) {
    const { error } = await this.db.rpc("submit_project_request", {
      p_token_hash: tokenHash,
      p_kind: kind,
      p_message: message ?? "",
    });
    if (error?.code === NO_DATA_FOUND) return "not_found" as const;
    if (error) throw new Error(`No se pudo guardar la solicitud (${error.code})`);
    return "created" as const;
  }
}

type MemoryState = {
  projects: Map<string, StoredProject>;
  requests: Array<{ tokenHash: string; kind: ProjectRequestKind; message: string | null }>;
};

class MemoryProjectStore implements ProjectStore {
  // En globalThis para sobrevivir a la recarga en caliente de `next dev`.
  private state: MemoryState = ((
    globalThis as { __construfacilProjects?: MemoryState }
  ).__construfacilProjects ??= { projects: new Map(), requests: [] });

  async submitProject(lead: Omit<NewLead, "source">, project: NewProject) {
    await getLeadStore().submitLead({ ...lead, source: "project" }, null);
    const code = `CF-P-${crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
    const now = new Date().toISOString();
    this.state.projects.set(project.tokenHash, {
      code,
      contact: {
        fullName: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        preferredChannel: lead.preferredChannel,
        usState: lead.usState,
      },
      name: project.name,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      locale: project.locale,
      firstName: firstNameOf(lead.fullName),
      input: project.input,
      estimate: project.estimate,
      usdToHnl: project.usdToHnl,
    });
    for (const oldest of this.state.projects.keys()) {
      if (this.state.projects.size <= MEMORY_LIMIT) break;
      this.state.projects.delete(oldest);
    }
    console.info(`[proyectos] guardado en memoria (modo ejemplo): ${code}`);
    return { code };
  }

  async findByTokenHash(tokenHash: string) {
    return this.state.projects.get(tokenHash) ?? null;
  }

  async updateSelections(tokenHash: string, update: ProjectUpdate) {
    const project = this.state.projects.get(tokenHash);
    if (!project || project.status !== "draft") return "not_editable" as const;
    this.state.projects.set(tokenHash, { ...project, ...update, updatedAt: new Date().toISOString() });
    return "updated" as const;
  }

  async submitRequest(tokenHash: string, kind: ProjectRequestKind, message: string | null) {
    const project = this.state.projects.get(tokenHash);
    if (!project || project.status === "closed") return "not_found" as const;
    this.state.requests.push({ tokenHash, kind, message });
    capArray(this.state.requests);
    return "created" as const;
  }
}

let store: ProjectStore | undefined;

export function getProjectStore(): ProjectStore {
  if (store) return store;
  if (canWriteToSupabase()) store = new SupabaseProjectStore();
  else if (isProductionDeploy()) throw new Error("En producción los proyectos necesitan Supabase.");
  else store = new MemoryProjectStore();
  return store;
}
