import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Todo texto visible sale de los archivos de traducción (messages/), nunca del componente.
    files: ["src/**/*.tsx"],
    ignores: ["src/components/ui/**"],
    rules: {
      "react/jsx-no-literals": ["error", { noStrings: true, ignoreProps: true, allowedStrings: [] }],
    },
  },
  {
    // Navegación: usar los envoltorios de `@/i18n/navigation`, que traducen la ruta.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/i18n/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message: "Usa `Link` de `@/i18n/navigation` para que la ruta salga traducida.",
            },
          ],
          patterns: [
            {
              group: ["next/navigation"],
              importNames: ["useRouter", "usePathname", "redirect", "permanentRedirect"],
              message: "Usa los equivalentes de `@/i18n/navigation`.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
