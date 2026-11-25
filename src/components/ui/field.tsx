import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Campos de formulario. Elementos nativos (el selector nativo es el mejor en el celular),
 * con 44 px de alto como mínimo, borde con contraste 3:1 y el error unido al campo con
 * aria-describedby.
 */

const control =
  "min-h-12 w-full rounded-xl border-2 border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground/80 focus-visible:border-brand aria-invalid:border-destructive disabled:opacity-60";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-base font-bold", className)} {...props} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "appearance-auto pr-3", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-28 py-3", className)} {...props} />;
}

export function Checkbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn("size-6 shrink-0 rounded accent-[var(--brand)]", className)}
      {...props}
    />
  );
}

/** Contenedor de un campo: etiqueta, control, ayuda y error, con los ids conectados. */
export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-bold text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** aria-describedby para un campo según tenga ayuda o error. */
export function describedBy(id: string, { hint, error }: { hint?: boolean; error?: boolean }) {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}
