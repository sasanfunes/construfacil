import { useLocale, useTranslations } from "next-intl";

import type { AppLocale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { squarify } from "@/lib/squarify";

import type { FloorPlanRoom } from "../types";

/**
 * Plano ilustrativo: reparte la superficie de cada planta entre sus ambientes según sus
 * m². No es un plano de construcción ni está a escala exacta; la lista de abajo da los
 * datos para quien usa lector de pantalla.
 */
export function FloorPlan({ rooms, title }: { rooms: readonly FloorPlanRoom[]; title: string }) {
  const t = useTranslations("catalog");
  const locale = useLocale() as AppLocale;
  const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
  if (rooms.length === 0) return null;

  return (
    <figure className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {floors.map((floor) => {
          const floorRooms = rooms.filter((r) => r.floor === floor);
          const area = floorRooms.reduce((sum, r) => sum + r.areaM2, 0);
          const width = Math.sqrt(area * 1.3);
          const height = area / width;
          const rects = squarify(
            floorRooms.map((r, index) => ({ ...r, value: r.areaM2, index })),
            { x: 0, y: 0, w: width, h: height },
          );
          return (
            <div key={floor} className="flex flex-col gap-2">
              {floors.length > 1 ? (
                <p className="text-sm font-bold text-muted-foreground">{t("plan.floor", { floor })}</p>
              ) : null}
              <svg
                viewBox={`-0.2 -0.2 ${width + 0.4} ${height + 0.4}`}
                role="img"
                aria-label={t("plan.floorAria", { name: title, floor })}
                className="w-full rounded-xl border bg-card"
              >
                {rects.map((r) => {
                  const big = r.w > 2.4 && r.h > 1.6;
                  const fontSize = Math.min(0.42, r.w / 7, r.h / 3.2);
                  return (
                    <g key={`${r.room}-${r.index}`}>
                      <rect
                        x={r.x}
                        y={r.y}
                        width={r.w}
                        height={r.h}
                        fill={
                          r.room === "carport" || r.room === "terrace" || r.room === "porch"
                            ? "#f3ece1"
                            : "#ffffff"
                        }
                        stroke="#0e2749"
                        strokeWidth={0.08}
                      />
                      {big ? (
                        <>
                          <text
                            x={r.x + r.w / 2}
                            y={r.y + r.h / 2 - fontSize * 0.2}
                            textAnchor="middle"
                            fontSize={fontSize}
                            fill="#0e2749"
                            fontWeight={700}
                          >
                            {t(`rooms.${r.room}`)}
                          </text>
                          <text
                            x={r.x + r.w / 2}
                            y={r.y + r.h / 2 + fontSize * 1.1}
                            textAnchor="middle"
                            fontSize={fontSize * 0.85}
                            fill="#4a5873"
                          >
                            {t("plan.area", { value: formatNumber(r.areaM2, locale, 1) })}
                          </text>
                        </>
                      ) : null}
                    </g>
                  );
                })}
              </svg>
            </div>
          );
        })}
      </div>
      <figcaption className="text-sm text-muted-foreground">{t("plan.caption")}</figcaption>
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-bold text-brand">
          {t("plan.listToggle")}
        </summary>
        <ul className="grid gap-1 sm:grid-cols-2">
          {rooms.map((r, index) => (
            <li key={`${r.room}-${index}`} className="flex justify-between gap-4 border-b py-1">
              <span>
                {t(`rooms.${r.room}`)}
                {floors.length > 1 ? ` · ${t("plan.floor", { floor: r.floor })}` : ""}
              </span>
              <span className="tabular-nums">
                {t("plan.area", { value: formatNumber(r.areaM2, locale, 1) })}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </figure>
  );
}
