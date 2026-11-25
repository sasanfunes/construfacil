"use client";

import { useEffect, useState } from "react";

/**
 * Convierte el horario de atención (hora de Honduras) a la hora de quien visita.
 * En el servidor no se sabe su zona horaria: se muestra después de cargar.
 */
export function LocalHours({
  open,
  close,
  sourceTimeZone,
  template,
}: {
  open: string;
  close: string;
  sourceTimeZone: string;
  /** Texto con {start}, {end} y {zone}, ya traducido. */
  template: string;
}) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!viewerZone || viewerZone === sourceTimeZone) return;
    const toViewer = (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number);
      // Hora de Honduras = UTC-6 todo el año (no tiene horario de verano).
      const today = new Date();
      const utc = Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
        (h ?? 0) + 6,
        m ?? 0,
      );
      return new Intl.DateTimeFormat(document.documentElement.lang || undefined, {
        hour: "numeric",
        minute: "2-digit",
        timeZone: viewerZone,
      }).format(new Date(utc));
    };
    const zone =
      new Intl.DateTimeFormat(document.documentElement.lang || undefined, {
        timeZoneName: "short",
        timeZone: viewerZone,
      })
        .formatToParts(new Date())
        .find((part) => part.type === "timeZoneName")?.value ?? viewerZone;
    // Se calcula después de montar a propósito: en el servidor no existe la zona del visitante.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(
      template.replace("{start}", toViewer(open)).replace("{end}", toViewer(close)).replace("{zone}", zone),
    );
  }, [open, close, sourceTimeZone, template]);

  return text ? <p className="text-sm text-brand-muted">{text}</p> : null;
}
