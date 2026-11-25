"use client";

import "leaflet/dist/leaflet.css";

import type { Map as LeafletMap } from "leaflet";
import { useEffect, useRef } from "react";

export type MapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  subtitle: string;
  href: string;
};

/**
 * Mapa con OpenStreetMap (sin costo, sin llave). Los marcadores son HTML propio: así no
 * dependen de las imágenes de Leaflet y usan los colores de la marca. El contenido de
 * los globos se arma con nodos de texto, nunca con HTML: los títulos vienen de la base.
 */
export default function CatalogMap({
  points,
  ariaLabel,
  linkLabel,
  className,
  zoom,
}: {
  points: MapPoint[];
  ariaLabel: string;
  linkLabel: string;
  className?: string;
  zoom?: number;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: LeafletMap | undefined;
    let cancelled = false;

    void import("leaflet").then((L) => {
      if (cancelled || !container.current) return;
      map = L.map(container.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: '<span style="display:block;width:22px;height:22px;border-radius:9999px;background:#c2512f;border:3px solid #ffffff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const bounds = L.latLngBounds([]);
      for (const point of points) {
        const popup = document.createElement("div");
        const title = document.createElement("p");
        title.textContent = point.title;
        title.style.cssText = "margin:0 0 4px;font-weight:700;font-size:15px";
        const subtitle = document.createElement("p");
        subtitle.textContent = point.subtitle;
        subtitle.style.cssText = "margin:0 0 8px";
        const link = document.createElement("a");
        link.href = point.href;
        link.textContent = linkLabel;
        link.style.cssText = "font-weight:700;color:#0e2749;text-decoration:underline";
        popup.append(title, subtitle, link);

        L.marker([point.latitude, point.longitude], { icon, title: point.title, keyboard: true })
          .bindPopup(popup)
          .addTo(map);
        bounds.extend([point.latitude, point.longitude]);
      }

      if (points.length === 1) map.setView(bounds.getCenter(), zoom ?? 13);
      else if (points.length > 1) map.fitBounds(bounds, { padding: [32, 32], maxZoom: zoom ?? 12 });
      else map.setView([14.9, -87.5], 7); // Honduras
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points, linkLabel, zoom]);

  return <div ref={container} role="region" aria-label={ariaLabel} className={className} />;
}
