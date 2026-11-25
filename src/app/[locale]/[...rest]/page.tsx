import { notFound } from "next/navigation";

/** Cualquier ruta desconocida muestra el 404 traducido de `[locale]/not-found.tsx`. */
export default function CatchAllPage() {
  notFound();
}
