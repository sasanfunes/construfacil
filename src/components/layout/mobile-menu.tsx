"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { usePathname } from "@/i18n/navigation";

/**
 * Menú del celular. Es un <details>: abre y cierra sin JavaScript. Con JavaScript, además
 * se cierra solo al navegar, porque el encabezado no se vuelve a montar entre páginas.
 */
export function MobileMenu({
  openLabel,
  closeLabel,
  children,
}: {
  openLabel: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  return (
    <details ref={ref} className="group lg:hidden">
      <summary className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-full text-brand hover:bg-accent [&::-webkit-details-marker]:hidden">
        <Menu aria-hidden="true" className="size-6 group-open:hidden" />
        <X aria-hidden="true" className="hidden size-6 group-open:block" />
        <span className="sr-only group-open:hidden">{openLabel}</span>
        <span className="sr-only hidden group-open:inline">{closeLabel}</span>
      </summary>
      <div className="absolute inset-x-0 top-full z-30 border-b bg-background shadow-lg">{children}</div>
    </details>
  );
}
