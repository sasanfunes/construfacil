import { defineConfig } from "vitest/config";

/**
 * Tests de seguridad de la base (RLS, permisos, triggers) contra un Postgres real.
 * Necesitan TEST_DATABASE_URL. Ver README, sección "Tests de RLS".
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["supabase/tests/**/*.test.ts"],
    globalSetup: ["supabase/tests/global-setup.ts"],
    setupFiles: ["supabase/tests/setup.ts"],
    // Todos los archivos comparten una base: se corren uno tras otro.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
