import type { Metadata } from "next";
import { connection } from "next/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { WhatsAppButton } from "@/components/layout/whatsapp-button";

/**
 * Enlace privado de una cotización. Es una ruta privada: se genera en cada visita (para
 * la CSP con nonce), no se cachea y no se indexa. Lleva el encabezado y el pie del sitio.
 */
export const instant = false;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function QuoteLayout({ children }: LayoutProps<"/[locale]/quote">) {
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
