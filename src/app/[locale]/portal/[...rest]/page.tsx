import { notFound } from "next/navigation";
import { connection } from "next/server";

/**
 * 404 dentro del área privada. Espera a la petición para que la respuesta se genere en el
 * momento y sus scripts lleven el nonce; si no, la CSP estricta los bloquearía.
 */
export default async function PortalCatchAllPage() {
  await connection();
  notFound();
}
