import type { Metadata } from "next";
import { connection } from "next/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { WhatsAppButton } from "@/components/layout/whatsapp-button";

/**
 * Panel privado de un proyecto: se abre con el enlace que le llega al cliente por correo.
 * Es una ruta privada: se genera en cada visita (para la CSP con nonce), no se cachea, no
 * se indexa y no manda la URL (con el token) como referencia a otros sitios.
 */
export const instant = false;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ProjectLayout({ children }: LayoutProps<"/[locale]/project">) {
  // Todo el árbol se genera en cada visita: un armazón prerenderizado no llevaría el nonce de la CSP.
  await connection();
  return (
    <>
      <SiteHeader />
      <main id="contenido" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
      <WhatsAppButton />
    </>
  );
}
