import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseAnonClient } from "@/lib/supabase/server";

import { activeModels, listedHomes, type Catalog } from "../catalog";
import { SAMPLE_CATALOG } from "../sample";

export type DetailKind = "home" | "model";
type SlugSets = Record<DetailKind, ReadonlySet<string>>;

/** Cuánto tiempo se reutiliza la lista. Una casa recién publicada tarda como máximo esto en verse. */
const TTL_MS = 60_000;

let cached: { expiresAt: number; slugs: Promise<SlugSets | null> } | null = null;

function fromCatalog(catalog: Pick<Catalog, "homes" | "models">): SlugSets {
  return {
    home: new Set(listedHomes(catalog).map((h) => h.slug)),
    model: new Set(activeModels(catalog).map((m) => m.slug)),
  };
}

async function load(): Promise<SlugSets | null> {
  if (!isSupabaseConfigured()) return fromCatalog(SAMPLE_CATALOG);
  const db = createSupabaseAnonClient();
  // El RLS ya filtra lo que un visitante puede ver; el filtro repite la regla de `listedHomes`.
  const [homes, models] = await Promise.all([
    db.from("homes").select("slug").in("listing_status", ["published", "reserved"]),
    db.from("house_models").select("slug").eq("is_active", true),
  ]);
  if (homes.error || models.error) return null;
  return {
    home: new Set(homes.data.map((row) => row.slug)),
    model: new Set(models.data.map((row) => row.slug)),
  };
}

/**
 * ¿Existe una ficha pública con este slug? La usa el proxy para mandar las URLs inventadas
 * a un único 404 antes de que Next genere y guarde una página por cada una (ISR): sin esto,
 * pedir miles de slugs al azar llenaría el disco o la caché del servidor.
 *
 * Si la base no responde devuelve `true`: decide la página, que también comprueba el slug.
 */
export async function isPublishedSlug(kind: DetailKind, slug: string): Promise<boolean> {
  const now = Date.now();
  if (!cached || cached.expiresAt <= now) {
    cached = { expiresAt: now + TTL_MS, slugs: load().catch(() => null) };
  }
  const slugs = await cached.slugs;
  if (!slugs) {
    // Reintenta en unos segundos, sin consultar la base en cada petición mientras falla.
    if (cached) cached.expiresAt = Math.min(cached.expiresAt, Date.now() + 5_000);
    return true;
  }
  return slugs[kind].has(slug);
}
