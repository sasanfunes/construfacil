"use client";

import { SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/** Filtros plegables: cerrados en el celular para no tapar los resultados, abiertos en pantallas grandes. */
export function FilterPanel({ summary, children }: { summary: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current && window.matchMedia("(min-width: 1024px)").matches) ref.current.open = true;
  }, []);
  return (
    <details ref={ref} className="group rounded-2xl border bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-5 font-bold [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal aria-hidden="true" className="size-5 text-brand" />
        {summary}
      </summary>
      <div className="border-t p-5">{children}</div>
    </details>
  );
}
