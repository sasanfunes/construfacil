# ConstruFácil

Plataforma web para que migrantes hondureños en Estados Unidos compren o construyan su casa en Honduras, viendo cada avance y pagando por etapas.

- **Qué es y para quién:** [`PROJECT_BRIEF.md`](./PROJECT_BRIEF.md)
- **Arquitectura, modelo de datos y rutas:** [`docs/plan-fase-0.md`](./docs/plan-fase-0.md)
- **Decisiones tomadas:** [`docs/decisiones.md`](./docs/decisiones.md)
- **Estado de seguridad:** [`docs/seguridad.md`](./docs/seguridad.md)

**Estado:** Fase 0 terminada (base del proyecto). Sigue la Fase 1: sitio público y captación.

## Requisitos

- Node.js 22
- pnpm 10 (`corepack enable` lo instala)
- Para los tests de RLS: Docker, o un Postgres local vacío

## Empezar

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Abre <http://localhost:3000>. El sitio público arranca sin Supabase; las llaves solo hacen falta para lo que lee o escribe en la base.

## Comandos

| Comando          | Qué hace                                                        |
| ---------------- | --------------------------------------------------------------- |
| `pnpm dev`       | Servidor de desarrollo                                          |
| `pnpm build`     | Build de producción                                             |
| `pnpm start`     | Sirve el build de producción                                    |
| `pnpm lint`      | ESLint                                                          |
| `pnpm typecheck` | Genera los tipos de rutas y corre TypeScript                    |
| `pnpm format`    | Prettier (escribe). `pnpm format:check` solo revisa             |
| `pnpm test`      | Tests de lógica con Vitest                                      |
| `pnpm test:rls`  | Tests de seguridad de la base contra Postgres                   |
| `pnpm test:e2e`  | Pruebas de punta a punta con Playwright (requiere `pnpm build`) |
| `pnpm check`     | Lint + tipos + tests de lógica                                  |

## Variables de entorno

Todas están documentadas en [`.env.example`](./.env.example). Dos reglas:

1. Lo que empieza con `NEXT_PUBLIC_` viaja al navegador. Nunca pongas un secreto ahí.
2. `.env.local` no se sube al repo. En Vercel las variables se cargan en el panel del proyecto.

`src/lib/env.ts` valida las públicas y `src/lib/env.server.ts` las secretas. Si falta o está mal una variable, el error dice cuál.

## Base de datos (Supabase)

El esquema vive en `supabase/migrations/` como SQL versionado. Todas las tablas llevan RLS.

Cuando exista el proyecto en supabase.com:

```bash
pnpm dlx supabase login
```

```bash
pnpm dlx supabase link --project-ref <ref-del-proyecto>
```

```bash
pnpm dlx supabase db push
```

```bash
pnpm dlx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

Después copia la URL y las llaves del proyecto a `.env.local` (y a Vercel). `supabase/seed.sql` trae datos de **ejemplo** para desarrollo; no se carga en producción.

### Tests de RLS

Comprueban, entrando como visitante, cliente, cada rol del equipo y servidor, que nadie ve ni modifica lo que no le toca. Corren contra un Postgres real con las migraciones aplicadas.

```bash
pnpm db:test
```

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/postgres pnpm test:rls
```

Los tests crean y borran una base llamada `construfacil_rls_test`, y se niegan a correr contra un servidor que no sea local.

`supabase/tests/supabase-shim.sql` imita en un Postgres normal lo mínimo de Supabase (roles `anon`, `authenticated`, `service_role` y `auth.uid()`). Antes de salir a producción hay que correr la misma suite contra el proyecto de staging.

## Pruebas de punta a punta

```bash
pnpm build
```

```bash
pnpm exec playwright install chromium
```

```bash
pnpm test:e2e
```

Corren en viewport de celular y de escritorio. Cualquier error en la consola del navegador hace fallar la prueba.

## Estructura

```
messages/{es,en}/     Textos traducidos, un archivo por área
supabase/migrations/  Esquema de la base (SQL)
supabase/tests/       Tests de RLS
e2e/                  Playwright
src/app/[locale]/     Páginas: (public), portal, admin
src/components/       ui (shadcn), layout, shared
src/features/         Un directorio por dominio (desde la Fase 1)
src/i18n/             Idiomas y rutas traducidas
src/lib/              env, supabase, auth, security, money
src/proxy.ts          Idioma + CSP de rutas privadas (antes middleware.ts)
```

## Idiomas

Español es el idioma por defecto y va sin prefijo (`/casas`); inglés va bajo `/en` (`/en/homes`). Todo texto visible sale de `messages/`: ESLint rechaza texto escrito directo en un componente, y un test comprueba que español e inglés tengan las mismas llaves.

## Despliegue

Vercel. El checklist de producción se completa en la Fase 4. Hasta el lanzamiento, `NEXT_PUBLIC_ALLOW_INDEXING` queda en `false` para que los buscadores no indexen un sitio con datos de ejemplo.
