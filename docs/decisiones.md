# Registro de decisiones

Una entrada por decisión, la más reciente arriba. Si una decisión cambia, se agrega una entrada nueva que la reemplaza; no se borra la anterior.

## 24 nov 2026 — Fase 0

### Negocio (decidió el dueño del producto)

| Tema               | Decisión                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Modelo de pagos    | Por etapas contra avance: pago inicial y luego un pago por etapa. Sin intereses y sin guardar saldos del cliente.                |
| Cobertura inicial  | Cortés, Francisco Morazán, Atlántida y Comayagua.                                                                                |
| Videollamada (MVP) | Solicitud simple: día y franja horaria; ventas confirma por WhatsApp.                                                            |
| Supabase           | Sin proyecto en la nube todavía. Se trabaja con migraciones y Postgres local.                                                    |
| Estilo visual      | Opción B (Lexend + Atkinson Hyperlegible, formas redondas) con la paleta **B1 "Teja"**: marfil 60 %, azul noche 30 %, teja 10 %. |

### Supuestos aceptados sin objeción

Se propusieron en `docs/plan-fase-0.md` y siguen vigentes mientras el dueño no diga lo contrario.

- Código y base en inglés; URLs y textos traducidos.
- Español sin prefijo, inglés bajo `/en` con rutas traducidas.
- La cotización de la Fase 1 se guarda con el correo y un enlace privado; en la Fase 2 se liga a la cuenta.
- Tipo de cambio de referencia fijado por un admin. El precio oficial es en USD.
- Terrenos en m² y varas cuadradas.
- El familiar autorizado ve avances, cronograma y entregas. Pagos y documentos, solo si el dueño del proyecto lo activa.
- Carrito en el dispositivo; el servidor recalcula los precios.
- Rate limiting en Postgres.
- Panel de admin bilingüe.

### Técnicas (tomadas durante el montaje)

**Cache Components activado.** Es el modo por defecto de Next.js 16.4 y será obligatorio en la siguiente versión mayor. Las páginas públicas se prerenderizan; lo dinámico se aísla.

**CSP en dos variantes.** Next aplica un nonce solo a páginas que se generan en cada visita, y eso es incompatible con el prerender.

- Rutas privadas (portal, admin, cuenta): CSP estricta con nonce y `strict-dynamic`. Comprobado: todos los scripts llevan nonce.
- Páginas públicas prerenderizadas: `script-src 'self' 'unsafe-inline'`. Next necesita scripts en línea para hidratar. El resto de la política queda cerrado: ningún dominio externo de scripts, sin iframes, sin plugins.
- Se evaluó la opción experimental de hashes (SRI): solo firma archivos externos, no los scripts en línea, así que no permite quitar `'unsafe-inline'`.
- `style-src` permite `'unsafe-inline'` en ambas variantes: los componentes de interfaz y el mapa posicionan con estilos en línea.

**Sin detección automática de idioma.** No se redirige según el idioma del navegador: muchos celulares en EE. UU. están en inglés aunque su dueño prefiera español. El idioma se elige con el selector.

**Fuentes servidas desde el propio dominio.** Sin peticiones a Google: mejor privacidad, CSP más simple y builds que no dependen de la red.

**Tests de RLS con un shim de Supabase.** No hay Docker en el entorno de desarrollo en la nube, así que la suite corre contra Postgres normal con un archivo que imita los roles y `auth.uid()` de Supabase. El shim reproduce el default de Supabase de abrir cada tabla nueva a los tres roles, para que los tests demuestren que el RLS es lo que protege. Antes de producción la misma suite debe correr contra el proyecto de staging.

**Roles en tabla aparte.** `user_roles` separado de `profiles`, para que nadie pueda subirse de rol editando su perfil. Un admin no puede cambiar su propio rol.

**Las acciones del equipo usan su propia sesión, no el service role.** Así `auth.uid()` queda en la bitácora. El service role se reserva para operaciones del sistema.

**No hay cliente de Supabase en el navegador.** La cookie de sesión es `HttpOnly` para que un script inyectado no pueda robarla. Todo acceso a datos pasa por el servidor. Si más adelante se quiere chat en tiempo real, se revisa.

**Todo nace cerrado en la base.** La primera migración revoca los permisos por defecto de Supabase. Cada tabla abre solo lo necesario, por columna cuando hay columnas internas. Por eso las consultas deben nombrar sus columnas.

**El proxy atiende todas las peticiones.** No se excluyen las rutas con punto, como hace la configuración habitual de next-intl, porque dejaba rutas privadas sin CSP estricta y permitía llenar la caché con URLs inexistentes. A cambio, no se usan archivos sueltos en `/public` y las rutas de API se declaran en el proxy.

**Tipo de cambio corregible sin editar.** No hay una sola tasa por fecha: una tasa mal registrada se corrige agregando otra, y vale la más reciente.

**El 404 se completa en el navegador.** Con Cache Components, una ruta desconocida responde 404 con un documento mínimo y el contenido traducido se carga con JavaScript. Funciona y no se indexa, pero sin JavaScript la página queda en blanco. Se revisa en la Fase 4.

**El sitio no se indexa hasta el lanzamiento.** `NEXT_PUBLIC_ALLOW_INDEXING=false` agrega `noindex` a todo, porque el sitio muestra datos de ejemplo.

## Pendiente de decidir

| Tema                                       | Bloquea             | Nota                                                                  |
| ------------------------------------------ | ------------------- | --------------------------------------------------------------------- |
| Qué respalda "pagos protegidos por etapas" | Textos de la Fase 1 | Mientras tanto el sitio dice "Pagas cada etapa cuando ves el avance". |
| Términos reales de las garantías           | Fase 1              |                                                                       |
| Entidad legal en EE. UU.                   | Fase 3              | Stripe no abre cuentas a empresas constituidas en Honduras.           |
| Dominio, WhatsApp de ventas, constructora  | Lanzamiento         | Hoy van como valores de ejemplo en variables de entorno y ajustes.    |
| Fotos reales de obras y testimonios        | Lanzamiento         | Todo el contenido de ejemplo irá etiquetado.                          |
