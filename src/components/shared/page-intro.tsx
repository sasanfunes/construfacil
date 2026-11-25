import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Encabezado de página: título y una o dos líneas de introducción. */
export function PageIntro({
  title,
  intro,
  children,
  className,
}: {
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("container-page flex flex-col gap-4 pt-8 pb-6 md:pt-12", className)}>
      <h1 className="max-w-3xl text-3xl md:text-5xl">{title}</h1>
      {intro ? <p className="max-w-2xl text-lg text-muted-foreground">{intro}</p> : null}
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  id,
  className,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <h2 id={id} className={cn("text-2xl md:text-3xl", className)}>
      {children}
    </h2>
  );
}
