# Registro de decisiones

Una entrada por decisión, la más reciente arriba. Si una decisión cambia, se agrega una entrada nueva que la reemplaza; no se borra la anterior.

## 25 nov 2026 — Construir con proyectos

Cambio pedido por el dueño del producto después de revisar la Fase 1.

### Negocio (decidió el dueño del producto)

| Tema                | Decisión                                                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Secciones del sitio | Dos: **Casa lista** (comprar una casa) y **Construir**. Terrenos y Materiales dejan de ser secciones: comprar un terreno es un paso de Construir y los materiales se eligen dentro del proyecto.                                                             |
| Construir           | El cliente **crea un proyecto**: nombre, terreno (propio, comprar uno de los nuestros o seguir sin terreno), planos o diseño (desde cero o del catálogo) y materiales por etapa. Al final entra a su panel.                                                  |
| Etapas de obra      | Cuatro: **Cimentación, Obra gris, Techos y Acabados**. Antes de ellas, diseño y trámites (pago inicial). La tubería va en obra gris; muebles de baño y luminarias, en acabados.                                                                              |
| Cuenta              | Se crea **al final** del onboarding. Mientras no exista Supabase, el proyecto se guarda con un enlace privado por correo.                                                                                                                                    |
| Aportes de dinero   | **Abonos a paquetes de materiales**: cada abono es para el paquete de materiales de una etapa, a precio cerrado; se compra cuando está pagado. Es una venta con pagos parciales, no un saldo. Cobro real en la Fase 3, después de la revisión de un abogado. |
| Panel en esta ronda | Proyecto, materiales editables, cálculo, plan de pagos y paquetes de materiales. Contratar servicios, pedir pruebas de avance y soporte llegan al equipo como solicitud. Chat, documentos y cobros: Fases 2 y 3.                                             |
| Lista de materiales | La aprobada en el plan (estructura, impermeabilización, muros, entrepiso, techo, aislamiento, cielo falso, pisos, puertas, ventanas, baños y cocina). Precios de ejemplo hasta que el dueño dé los reales.                                                   |

### Técnicas

**Costo por opciones, no por acabado.** Reemplaza "Cómo se calcula una cotización" del 25 nov. Cada opción tiene un precio por unidad y una base: m² de construcción, m² de planta baja (cimentación y techo), m² de planta alta (entrepiso), por baño o fijo. Costo = cantidad × precio × factor del departamento, redondeado a dólares. Cada opción también aporta tiempo y dice qué parte de su costo son materiales (el resto es mano de obra): de ahí sale el paquete de materiales de cada etapa.

**Plan de pagos del proyecto.** Diseño y trámites al firmar; después, cada etapa se paga antes de empezar, al ver terminada la anterior. El terreno, si lo compra con nosotros, se paga aparte.

**El cotizador anterior se retira.** Sus tablas (`quotes`, `finish_levels`, `quote_extras`, `stage_templates`) quedan en la base como legado y el seed las sigue llenando para las pruebas. `modelos.base_price_usd_cents` ya no se usa para precios: el "desde" de un modelo sale del motor con las opciones recomendadas.

**Categorías de opciones: lista cerrada.** Cada categoría tiene su etapa, su nombre traducido y su lugar en el onboarding (`OPTION_CATEGORIES` y `private.construction_category_stage`). Agregar una es un cambio de código, no solo de datos.

**Proyecto con enlace privado de 365 días.** El cliente cambia materiales mientras el proyecto es un borrador; cuando ventas lo pasa a revisión, los cambios van por el equipo.

**Estados del proyecto en orden.** Borrador → en revisión → activo → cerrado. En revisión puede volver a borrador (el equipo se lo devuelve al cliente para que ajuste materiales); cerrado es final. Lo impone un trigger, no la interfaz.

**Cambiar materiales no cambia el terreno ni el diseño.** Al recalcular desde el panel, el terreno (ubicación y precio) y el diseño (área, plantas, baños) salen de lo guardado; los materiales se cobran a precio de hoy. Así un terreno apartado o un modelo retirado del catálogo no bloquean el panel, y lo que ve el cliente coincide con lo que ve el equipo.

**La base comprueba los montos.** El servidor los calcula y `private.check_project_amounts()` verifica, antes de guardar, precios contra el catálogo, cantidades contra el diseño, el factor del departamento y que las etapas sumen los totales. Si un administrador cambia un precio, un proyecto que se guarde en el mismo minuto (con la caché anterior) puede fallar; el cliente lo vuelve a intentar.

**Nombres solo con letras latinas.** El nombre de la persona y el del proyecto rechazan otros alfabetos: hay letras que imitan un punto y sirven para escribir dominios falsos. El nombre del proyecto admite hasta 4 números (no cabe un teléfono). Para nuestros clientes no es una restricción real; si algún día lo es, se revisa.

**El onboarding es una página estática.** Lee `?lot=`, `?model=` y `?land=buy` en el navegador, como el cotizador anterior, para no perder la caché.

**Redirecciones temporales.** `/terrenos`, `/materiales` y el cotizador viejo llevan a Construir (307 mientras el sitio no se indexa).

## 25 nov 2026 — Fase 1

### Técnicas

**Modo de ejemplo sin Supabase.** Mientras no exista el proyecto, el catálogo sale de `src/features/catalog/sample/` (marcado como ejemplo) y los leads, cotizaciones y contadores del rate limiting se guardan en memoria. Solo se permite con `APP_ENV` = development, ci, test o preview. Sin `APP_ENV`, todo build de producción y todo despliegue en Vercel exige la configuración completa: un despliegue mal configurado no arranca, en vez de perder leads en silencio.

**Cómo se calcula una cotización.**

- Precio del modelo × multiplicador del acabado × factor del departamento, redondeado a $100. Los extras se redondean a $1.
- Diseño propio: metros cuadrados × precio por m² del acabado.
- Plan de pagos: pago inicial (porcentaje en ajustes) y un pago por etapa, proporcional a su costo. Cada etapa se paga al ver terminada la anterior.
- El terreno, si lo compra con nosotros, se paga aparte y no entra en el plan por etapas.
- Se descartó una tabla de precio por modelo y acabado: un multiplicador por acabado es más fácil de mantener para el admin y da el mismo resultado.
- Las reglas de precio son públicas (las lee el visitante): el cotizador las muestra igual. Al guardar, el servidor recalcula todo y guarda la foto con el tipo de cambio del día.

**Cotización guardada con enlace privado.** El cliente recibe por correo un enlace con un token de 32 bytes, válido 180 días; el precio se mantiene 30. En la Fase 2 la cotización se liga a su cuenta si verificó el correo.

**Contenido en los archivos de traducción.** Preguntas frecuentes, testimonios, equipo y textos legales viven en `messages/` hasta que exista el panel (Fase 2). Testimonios y equipo van marcados como ejemplo. Los textos legales son un borrador que necesita revisión de un abogado antes del lanzamiento.

**El selector de idioma recarga la página.** Con un `Link`, el router de Next aprendía el patrón `/[locale]` al ir a `/en` y luego pedía `/casas` como si fuera un idioma (404 en la precarga). Un enlace normal evita la predicción equivocada; cambiar de idioma es poco frecuente.

**Fichas solo con slugs publicados.** Casas, terrenos y modelos usan ISR: Next genera y guarda una página por cada slug que alguien visita. El proxy deja pasar solo los publicados y manda los demás a un 404 fijo, para que URLs inventadas no llenen la caché. Se descartó quitar `generateStaticParams`: obligaba a envolver todo el layout en `<Suspense>`.

**El cotizador es una página estática.** Lee `?lot=` y `?model=` en el navegador, no en el servidor. Leerlos en el servidor hacía la página dinámica (sin caché) y bajaba el rendimiento en celular a 65.

**Zod sin JIT.** Zod v4 prueba `new Function("")` y la CSP lo prohíbe. Se importa de `@/lib/zod`, configurado con `jitless`.

**Ubicación aproximada.** Las coordenadas públicas llevan 3 decimales (~110 m). La dirección exacta se da en la videollamada.

**Correos con plantillas propias.** Los componentes de React Email están obsoletos; las plantillas usan HTML con estilos en línea y se convierten con `@react-email/render`. Sin Resend configurado, en desarrollo el correo solo se anuncia en la consola.

**Mapa con Leaflet y OpenStreetMap.** Se carga solo al abrir la vista de mapa. Para producción con tráfico real hace falta un proveedor de mosaicos con contrato (la política de uso de OpenStreetMap no lo permite); queda pendiente de decidir.

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

| Tema                                       | Bloquea     | Nota                                                                  |
| ------------------------------------------ | ----------- | --------------------------------------------------------------------- |
| Qué respalda "pagos protegidos por etapas" | Lanzamiento | Mientras tanto el sitio dice "Pagas cada etapa cuando ves el avance". |
| Términos reales de las garantías           | Lanzamiento | Los textos de garantía del sitio son de ejemplo.                      |
| Revisión legal de términos y privacidad    | Lanzamiento | Los textos legales del sitio son un borrador.                         |
| Proveedor de mosaicos del mapa             | Lanzamiento | OpenStreetMap no permite tráfico alto en sus servidores.              |
| Cuenta de Cloudflare para Turnstile        | Fase 2      | CAPTCHA para formularios y registro.                                  |
| Entidad legal en EE. UU.                   | Fase 3      | Stripe no abre cuentas a empresas constituidas en Honduras.           |
| Dominio, WhatsApp de ventas, constructora  | Lanzamiento | Hoy van como valores de ejemplo en variables de entorno y ajustes.    |
| Fotos reales de obras y testimonios        | Lanzamiento | Todo el contenido de ejemplo irá etiquetado.                          |
