import type { Metadata } from "next";

/**
 * Área privada. Estas rutas se generan en cada visita (nunca desde caché) para que
 * `proxy.ts` pueda aplicar la CSP estricta con nonce. `instant = false` le dice a Next
 * que aquí está permitido esperar al servidor.
 */
export const instant = false;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: LayoutProps<"/[locale]/portal">) {
  return (
    <main id="contenido" className="flex flex-1 flex-col">
      {children}
    </main>
  );
}
