import localFont from "next/font/local";

/**
 * Fuentes servidas desde nuestro propio dominio (sin peticiones a Google).
 * Lexend: títulos. Atkinson Hyperlegible: texto. Ambas con licencia SIL OFL 1.1.
 */
export const lexend = localFont({
  src: "./lexend-latin-variable.woff2",
  variable: "--font-lexend",
  weight: "100 900",
  display: "swap",
  fallback: ["Trebuchet MS", "Verdana", "sans-serif"],
});

export const atkinson = localFont({
  src: [
    { path: "./atkinson-hyperlegible-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./atkinson-hyperlegible-latin-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-atkinson",
  display: "swap",
  fallback: ["Verdana", "Arial", "sans-serif"],
});
