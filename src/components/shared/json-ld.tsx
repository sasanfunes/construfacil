/**
 * Datos estructurados para buscadores. Se escapa "<" para que ningún texto pueda cerrar la
 * etiqueta <script> (los textos vienen de las traducciones y de la base).
 */
export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  // JSON escapado, no HTML: no hay forma de inyectar etiquetas.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
