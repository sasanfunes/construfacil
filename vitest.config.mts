import path from "node:path";

import { defineConfig } from "vitest/config";

/** Tests de lógica (rápidos, sin base de datos). Los de RLS usan vitest.rls.config.ts. */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` lanza un error fuera de Next.js; en tests se reemplaza por un módulo vacío.
      "server-only": path.resolve(import.meta.dirname, "src/test/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "messages/**/*.test.ts"],
  },
});
