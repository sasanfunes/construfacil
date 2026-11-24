import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/** Usar siempre estos en lugar de `next/link` y `next/navigation`: traducen la ruta. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
