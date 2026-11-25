"use client";

import dynamic from "next/dynamic";

import type { MapPoint } from "./catalog-map";

/** Leaflet pesa: se carga solo en el navegador y solo cuando hay un mapa en pantalla. */
const CatalogMap = dynamic(() => import("./catalog-map"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse rounded-2xl bg-muted" />,
});

export function LazyMap(props: {
  points: MapPoint[];
  ariaLabel: string;
  linkLabel: string;
  className?: string;
  zoom?: number;
}) {
  return <CatalogMap {...props} />;
}

export type { MapPoint };
