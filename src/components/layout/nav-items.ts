import type { AppPathname } from "@/i18n/routing";

/** Menú principal: las dos secciones (Casa lista y Construir) y apoyo. El texto sale de common.nav. */
export const NAV_ITEMS = [
  { href: "/homes", key: "homes" },
  { href: "/build", key: "build" },
  { href: "/calculator", key: "calculator" },
  { href: "/how-it-works", key: "howItWorks" },
  { href: "/contact", key: "contact" },
] as const satisfies ReadonlyArray<{ href: AppPathname; key: string }>;
