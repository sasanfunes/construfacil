# Seguridad

Estado de seguridad de la plataforma, fase por fase. Cada cierre de fase agrega su revisión aquí.

## Controles en pie (Fase 0)

| Requisito del brief              | Cómo se cumple hoy                                                                                                                                      | Cómo se comprueba                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| RLS en todas las tablas          | Las 8 tablas llevan RLS y `GRANT` explícitos por tabla y columna                                                                                        | `supabase/tests/rls-coverage.test.ts` falla si falta      |
| Un cliente solo ve lo suyo       | Políticas por `auth.uid()`; el equipo entra por rol                                                                                                     | `supabase/tests/profiles.test.ts`, `user-roles.test.ts`   |
| Roles verificados en el servidor | Rol en `user_roles`, tabla aparte. Nadie cambia su propio rol, ni un admin. El rol nunca se toma de los metadatos del registro                          | `supabase/tests/user-roles.test.ts`                       |
| Secretos solo en el servidor     | `env.server.ts` y el cliente admin llevan `server-only`: importarlos desde el navegador rompe el build. `.env*` está ignorado por git                   | Build + escaneo de secretos en CI (gitleaks)              |
| Rate limiting                    | `check_rate_limit()` en Postgres, solo ejecutable por el servidor. IP y correo se guardan como huella SHA-256 con sal. Si el contador falla, se rechaza | `supabase/tests/rate-limit.test.ts`, tests de lógica      |
| Bitácora de auditoría            | `audit_log` de solo inserción: ni el servidor ni el dueño de la tabla pueden editar o borrar. Trigger genérico en roles, tipo de cambio y ajustes       | `supabase/tests/audit-log.test.ts`                        |
| Cabeceras de seguridad           | CSP, HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP. Sin `X-Powered-By`                                              | `e2e/smoke.spec.ts`                                       |
| CSP                              | Estricta con nonce en rutas privadas; sin dominios externos en las públicas                                                                             | `e2e/smoke.spec.ts` y cero errores de consola en cada e2e |
| CSRF                             | Las Server Actions de Next validan el origen. No hay endpoints que cambien datos por GET. Cookies de sesión `SameSite=Lax` (Supabase)                   | Se prueba al crear la primera acción (Fase 1)             |
| Datos personales mínimos         | El perfil guarda nombre, teléfono, país, estado e idioma. Nada de fechas de nacimiento, direcciones ni números de identidad                             | Revisión del esquema                                      |
| Dependencias                     | `pnpm audit` en CI. pnpm no ejecuta scripts de instalación de terceros                                                                                  | CI                                                        |

## Revisión de la Fase 0

Fecha: 24 nov 2026. Alcance: migraciones SQL, `proxy.ts`, `next.config.ts`, `src/lib/security`, `src/lib/supabase`, variables de entorno y CI.

### Corregido durante la revisión

| Hallazgo                                                                                                    | Corrección                                              |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Una ruta privada escrita con codificación (`/%70ortal`) no se reconocía como privada y recibía la CSP débil | `isPrivatePath` decodifica antes de comparar. Con tests |
| `notification_prefs` aceptaba JSON de cualquier tamaño: un usuario podía inflar su fila                     | Debe ser un objeto de 1 KB como máximo. Con test        |
| El selector de idioma tenía un nombre accesible distinto del texto visible (falla de WCAG 2.5.3)            | El nombre accesible ahora incluye el texto visible      |

### Riesgos aceptados, con su razón

1. **`'unsafe-inline'` en `script-src` de las páginas públicas.** Next.js hidrata con scripts en línea y un nonce exige generar la página en cada visita, lo que tiraría el rendimiento en móvil. La política pública no permite ningún dominio externo de scripts, ni iframes, ni plugins. Mitigación obligatoria: nunca renderizar HTML que venga de un usuario o del panel sin sanitizar (aplica al blog y a los mensajes).
2. **`'unsafe-inline'` en `style-src`.** Lo requieren los componentes de interfaz y el mapa. El riesgo de inyección por estilos es bajo y no hay contenido de usuarios todavía.
3. **El rate limiting confía en las cabeceras de IP de Vercel.** Es correcto en Vercel, que las sobrescribe. Si algún día se despliega en otro lado, hay que revisar `getClientIp`.
4. **Ventana fija en el rate limiting.** Permite hasta el doble del límite justo en el cambio de ventana. Aceptable para formularios; el login tiene además los límites propios de Supabase Auth.
5. **Tests de RLS sobre un shim.** La suite corre en Postgres normal con un archivo que imita a Supabase. Puede divergir del Supabase real.
6. **Acciones de GitHub fijadas por versión mayor, no por hash.** Un cambio malicioso en una acción de terceros llegaría al CI.

### Pendientes

| Pendiente                                                                                          | Cuándo                |
| -------------------------------------------------------------------------------------------------- | --------------------- |
| Correr la suite de RLS contra el proyecto real de Supabase (staging)                               | Al crear el proyecto  |
| Refrescar la sesión en `proxy.ts` y agregar `requireUser` / `requireRole` / `requireProjectAccess` | Fase 2                |
| Buckets privados y URL firmadas, con registro de cada descarga                                     | Fase 2                |
| Protección contra bots en formularios públicos (campo trampa y tiempo mínimo)                      | Fase 1                |
| Sanitizar el Markdown del blog y de las guías                                                      | Fase 1                |
| Política de retención de `audit_log` (los campos antes/después pueden contener datos personales)   | Fase 2                |
| Cifrado y borrado programado del número de identidad de quien recibe un pedido                     | Fase 3                |
| Fijar las acciones de GitHub por hash                                                              | Fase 4                |
| 404 con contenido aunque el navegador no tenga JavaScript                                          | Fase 4                |
| Revisión legal de privacidad (EE. UU. y Honduras) antes de recibir datos reales                    | Antes del lanzamiento |
