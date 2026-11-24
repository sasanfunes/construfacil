# ConstruFácil — convenciones del proyecto

Plataforma para que migrantes hondureños en EE. UU. compren o construyan su casa en Honduras. El problema que resolvemos es la **confianza**: cada decisión debe hacer que el cliente sienta que su dinero está seguro y que ve lo que pasa.

Lee antes de trabajar:

- `PROJECT_BRIEF.md`: qué se construye y cómo quiere trabajar el dueño del producto.
- `docs/plan-fase-0.md`: arquitectura, modelo de datos, permisos por rol y rutas.
- `docs/decisiones.md`: decisiones ya tomadas. No las reabras sin motivo.
- `docs/seguridad.md`: estado de seguridad y pendientes.

@AGENTS.md

## Cómo trabajar

- Se trabaja por fases (sección 9 del brief). No se avanza de fase sin confirmación del dueño.
- Si algo es ambiguo o choca con buenas prácticas, se pregunta en vez de asumir.
- Al cerrar una fase: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:rls`, `pnpm build`, `pnpm test:e2e`, levantar el sitio, revisar la consola, revisión de seguridad del código nuevo y resumen corto.
- Commits pequeños, uno por tarea, en español, con prefijo (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`).
- Datos de ejemplo realistas para Honduras, siempre marcados como ejemplo (`is_example`).

## Idioma del código

- Identificadores, tablas, columnas y nombres de archivo: **inglés**.
- Comentarios, documentación, commits y mensajes de error para desarrolladores: **español**.
- Los roles llevan los nombres exactos del brief: `cliente`, `familiar_autorizado`, `ventas`, `gerente_proyecto`, `logistica`, `admin`.

## Next.js 16: lo que cambia

Esta versión no es la que conoces. Antes de usar una API de Next, lee su guía en `node_modules/next/dist/docs/`.

- **Cache Components está activo.** Las páginas se prerenderizan y lo dinámico va dentro de `<Suspense>` o en funciones con `"use cache"`.
- **Nada de `new Date()`, `Date.now()`, `Math.random()` ni `crypto.randomUUID()` durante el prerender**: rompe el build. Va dentro de `"use cache"`, después de `await connection()`, o en un componente de cliente.
- **`src/proxy.ts`** reemplaza a `middleware.ts`.
- El idioma se lee con `next/root-params` (lo hace `src/i18n/request.ts`). No se usa `setRequestLocale`.
- **Rutas privadas** (`portal`, `admin`, cuenta, cotización guardada, checkout): su layout exporta `instant = false` y la página hace `await connection()`. Así no se cachean y reciben la CSP con nonce. Toda ruta privada nueva se agrega a `PRIVATE_SEGMENTS` en `src/lib/security/private-paths.ts`, en todos los idiomas; un test falla si una carpeta de `src/app/[locale]` queda sin clasificar. Las páginas públicas viven dentro de `src/app/[locale]/(public)/`.
- **El proxy atiende todas las peticiones** salvo `/_next/`. Consecuencias: una ruta de API nueva se agrega a `API_ROUTES` en `src/proxy.ts` (si no, responde 404), y **no se usan archivos sueltos en `/public`**: las imágenes se importan desde el código o vienen de Supabase Storage. Los archivos de metadatos de la raíz (`robots.txt`, `sitemap.xml`…) están en `PASSTHROUGH_FILES`.
- El proxy no es la barrera de acceso: cada página y cada acción privada comprueba la sesión y el rol.
- `params` y `searchParams` son promesas. Los tipos `PageProps<"/ruta">` y `LayoutProps<"/ruta">` son globales y los genera `next typegen`.

## Idiomas (next-intl)

- **Ningún texto visible va escrito en un componente.** Todo sale de `messages/{es,en}/<área>.json`. ESLint (`react/jsx-no-literals`) lo impide.
- Cada llave nueva se agrega en español y en inglés. `messages/messages.test.ts` falla si no coinciden.
- Un área nueva = un archivo JSON por idioma + su import en `messages/{es,en}/index.ts`.
- Cada ruta nueva se declara en `pathnames` de `src/i18n/routing.ts` con su traducción.
- Navegación: `Link`, `redirect`, `useRouter`, `usePathname` de `@/i18n/navigation`. Nunca `next/link`.
- En Server Components: `getTranslations("área")`. En Server Actions y Route Handlers no hay root params: `getTranslations({ locale, namespace })`.
- Al navegador solo viajan los textos que usan los componentes de cliente (ver `NextIntlClientProvider` en el layout raíz). Lo normal es traducir en el servidor y pasar el texto como prop.
- Español hondureño neutro, cálido y sin tecnicismos: "pago inicial", no "enganche". Términos como "obra gris" o "escritura" se explican con un tooltip.

## Diseño

- Paleta **B1 "Teja"**, repartida 60/30/10. Los tokens están en `src/app/globals.css`:
  - 60 % `background` (marfil): fondo de las páginas.
  - 30 % `brand` (azul noche): bloques grandes como hero, bandas y pie.
  - 10 % `primary` (teja): lo que se toca. **Un solo botón teja por pantalla.**
- Sobre un bloque azul noche se pone la clase `on-brand` (ajusta el anillo de foco) y el texto secundario usa `text-brand-muted`.
- Títulos en Lexend (`font-display`), texto en Atkinson Hyperlegible (`font-sans`). Se sirven desde `src/app/fonts/`, sin Google.
- Formas redondeadas: tarjetas `rounded-2xl`, botones `rounded-full`.
- Mobile-first. Controles de 44 px de alto como mínimo. Contraste AA.
- Precios en USD con el equivalente aproximado en lempiras (`src/lib/money`).
- Cada pantalla diseña sus estados vacío, de carga y de error.
- Componentes de `src/components/ui/` siguen el patrón shadcn/ui. Para agregar uno: `pnpm dlx shadcn@latest add <componente>` y se ajusta a los tokens.

## Seguridad (no negociable)

- **RLS en todas las tablas**, con `GRANT` explícitos por tabla y por columna. Todo objeto nuevo de `public` nace cerrado para `anon` y `authenticated`. No se exponen por la API columnas internas (`created_by`, `updated_by`, ids de Stripe). Cada tabla nueva llega con sus tests en `supabase/tests/`. `rls-coverage.test.ts` falla si una tabla queda sin RLS o sin políticas, y lleva la lista exacta de permisos de tabla completa: si cambia, que sea a propósito.
- Las vistas de `public` se crean con `security_invoker = true`.
- **Permisos en el servidor, siempre.** Ocultar un botón no es seguridad.
- **Las consultas nombran sus columnas.** Varias tablas dan permiso de lectura por columna, así que `select("*")` es rechazado por la base.
- **No hay cliente de Supabase en el navegador.** La cookie de sesión es `HttpOnly`; todo acceso a datos pasa por el servidor.
- **Tres clientes de Supabase** (`src/lib/supabase/`), todos de servidor:
  - `createSupabaseServerClient()`: con la sesión de la persona. Es el cliente por defecto, también para acciones del equipo, porque así `auth.uid()` queda en la auditoría.
  - `createSupabaseAnonClient()`: sin sesión, para datos públicos en páginas cacheadas.
  - `createSupabaseAdminClient()`: service role, se salta el RLS. Solo para operaciones del sistema (lead de un formulario público, webhook de Stripe, rate limiting, auditoría), después de validar con Zod y comprobar permisos.
- **Zod** en cada formulario y en cada Server Action o Route Handler. El mismo esquema valida en cliente y servidor.
- **Rate limiting** al inicio de toda acción pública: `enforceRateLimit(acción, getRequestIdentifier(await headers()))` de `src/lib/security/rate-limit.ts`. No cubre los endpoints de Supabase Auth, que se protegen en Supabase.
- **Auditoría**: las tablas sensibles llevan el trigger `private.audit_row_change()`. Lo que un trigger no ve se registra con `logAudit()`.
- **Dinero**: montos en centavos de USD, enteros. Los precios se calculan en el servidor desde la base; del cliente solo llegan identificadores.
- **Secretos**: solo en `src/lib/env.server.ts` y módulos con `import "server-only"`. Nunca con prefijo `NEXT_PUBLIC_`.
- **Documentos**: buckets privados y URL firmada de corta duración generada en el servidor.
- **Funciones SQL `security definer`**: siempre `set search_path = ''` y nombres con esquema. Las de permisos van en el esquema `private`.
- No se registran datos personales ni secretos en logs.

## Base de datos

- Migraciones en `supabase/migrations/`, nombre `AAAAMMDDhhmmss_descripcion.sql`. Una migración aplicada no se edita: se agrega otra.
- Llave primaria `uuid`. `created_at` y `updated_at` con el trigger `private.set_updated_at()`.
- Dinero: `*_usd_cents bigint`.
- Textos traducibles: columnas pares `title_es` y `title_en`.
- Tablas con historia (cotizaciones, pagos, pedidos) guardan copia del precio y del tipo de cambio del momento.
- Tras cambiar el esquema se actualiza `src/lib/supabase/database.types.ts`.

## Organización del código

- `src/app/` arma páginas con piezas de `src/features/`; `features/` usa `components/` y `lib/`; `lib/` no importa de `features/` ni de `app/`.
- Cada dominio en `src/features/<dominio>/` con `components/`, `actions.ts`, `queries.ts`, `schemas.ts` y sus tests.
- La lógica de negocio (precios, calculadora, dinero) son funciones puras con tests en Vitest.
- Server Components por defecto. `"use client"` solo donde hay interacción.

## Tests

| Qué                                 | Dónde              | Comando         |
| ----------------------------------- | ------------------ | --------------- |
| Lógica pura, esquemas, traducciones | `src/**/*.test.ts` | `pnpm test`     |
| RLS, permisos y triggers            | `supabase/tests/`  | `pnpm test:rls` |
| Flujos críticos, accesibilidad, CSP | `e2e/`             | `pnpm test:e2e` |

Los e2e fallan con cualquier error en la consola del navegador. Si un caso lo espera (por ejemplo un 404), se desactiva solo en esa prueba.
