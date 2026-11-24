import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Botón base (patrón shadcn/ui). El tamaño mínimo es 44px de alto en todas las variantes.
 * `default` es la acción principal y usa teja: solo debe haber uno por pantalla.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        brand: "bg-brand text-brand-foreground hover:bg-brand/90",
        outline: "border-2 border-brand bg-transparent text-brand hover:bg-accent",
        "outline-on-brand": "border-2 border-white bg-transparent text-white hover:bg-white/10",
        ghost: "text-brand hover:bg-accent",
        link: "min-h-11 rounded-md px-0 text-brand underline underline-offset-4 hover:text-primary",
      },
      size: {
        default: "min-h-11 px-5 text-base [&_svg]:size-5",
        lg: "min-h-13 px-7 text-lg [&_svg]:size-5",
        icon: "size-11 [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Renderiza el hijo (por ejemplo un enlace) con el estilo de botón. */
    asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
