# ConstruFácil — Brief del proyecto

Plataforma de construcción para migrantes hondureños. Este es el documento de origen del proyecto, tal como lo escribió el dueño del producto. El plan técnico derivado está en `docs/plan-fase-0.md`.

## 1. Contexto del proyecto

Vas a construir ConstruFácil, una plataforma web para migrantes hondureños que viven en Estados Unidos. La idea central es: en lugar de mandar remesas que se gastan, el migrante invierte ese dinero en patrimonio en Honduras, comprando o construyendo su casa desde EE. UU., con total transparencia de lo que pasa con su dinero.

El usuario tiene cuatro caminos (son los cuatro pilares del producto):

1. Casa lista: comprar una casa terminada (o en preventa o construcción) en Honduras.
2. Construir en mi terreno: servicio completo de diseño, construcción y materiales sobre un terreno que ya tiene.
3. Comprar terreno: si no tiene terreno, se lo vendemos (y puede seguir con el camino 2).
4. Materiales para mi obra: comprar materiales desde EE. UU. y que se entreguen en su obra en Honduras.

Usuario principal: hondureño de 25 a 55 años en EE. UU., que usa sobre todo el celular, habla español (algunos prefieren inglés), y suele tener poca confianza por experiencias de estafas o de familiares que "se gastaron el dinero". Muchas veces tiene un familiar en Honduras que supervisa la obra.

Usuario secundario: el familiar o apoderado en Honduras, que necesita ver avances y recibir entregas.

El problema número uno que resolvemos es la CONFIANZA. Cada decisión de diseño y producto debe responder a: "¿esto hace que el migrante sienta que su dinero está seguro y que ve lo que pasa?"

## 2. Cómo quiero que trabajes

- Antes de escribir código, lee todo este documento, haz las preguntas que tengas y luego propón un plan de arquitectura (estructura de carpetas, modelo de datos y rutas). Espera mi aprobación.
- Trabaja por fases (ver sección 9). No avances a la siguiente fase sin que yo lo confirme.
- Al terminar cada fase: corre el linter, los type-checks y los tests, levanta el proyecto, revisa que no haya errores en consola y dame un resumen corto de lo hecho y lo pendiente.
- Usa datos de ejemplo (seed) realistas para Honduras (departamentos, ciudades, precios en USD y lempiras) para que todo se vea completo desde el inicio.
- Haz commits pequeños y descriptivos al cerrar cada tarea.
- Mantén un `README.md` con cómo correr el proyecto y un `CLAUDE.md` con las convenciones del proyecto.
- Si algo de este documento es ambiguo o choca con buenas prácticas, pregúntame en vez de asumir.

## 3. Stack técnico

- Framework: Next.js (última versión estable, App Router) + TypeScript en modo estricto.
- UI: Tailwind CSS + shadcn/ui + lucide-react para íconos.
- Backend y base de datos: Supabase (Postgres, Auth, Storage). Row Level Security (RLS) activado en TODAS las tablas.
- Validación: Zod en todos los formularios y en cada endpoint o Server Action.
- Pagos: Stripe (tarjeta y ACH de EE. UU.), con webhooks. Va en la Fase 3; deja la arquitectura preparada desde el inicio.
- Idiomas: next-intl. Español como idioma por defecto e inglés como secundario. Todo el texto debe estar en archivos de traducción, nunca escrito directo en los componentes.
- Correos: Resend + React Email.
- Mapas: Leaflet con OpenStreetMap (sin costo) para ubicar casas, terrenos y obras.
- Despliegue: Vercel.
- Tests: Vitest para la lógica y Playwright para los flujos críticos (cotizador, registro, checkout, portal).

## 4. Seguridad (obligatorio, no negociable)

La plataforma maneja dinero, documentos legales y datos personales de migrantes. Trátalo como una fintech:

- RLS en cada tabla: un cliente solo ve sus propios proyectos, pagos, documentos y pedidos. Escribe tests que lo comprueben.
- Roles: `cliente`, `familiar_autorizado` (solo lectura del proyecto al que lo invitaron), `ventas`, `gerente_proyecto`, `logistica` y `admin`. Verifica permisos en el servidor, nunca solo en la interfaz.
- Las llaves secretas (service role de Supabase, Stripe y Resend) solo existen en el servidor y en variables de entorno. Crea un `.env.example` y nunca subas `.env` al repo.
- Los documentos (contratos, escrituras, identificaciones) van en buckets privados de Storage y se acceden con URLs firmadas de corta duración.
- Verifica la firma de los webhooks de Stripe y nunca confíes en montos enviados desde el cliente: los precios se calculan en el servidor.
- Rate limiting en login, registro, formularios de contacto y cotizador.
- Bitácora de auditoría (`audit_log`) para acciones sensibles: cambios de precio, pagos, cambios de estado de obra y subida o eliminación de documentos.
- Encabezados de seguridad (CSP, HSTS, etc.) y protección CSRF donde aplique.
- No guardes números de tarjeta (Stripe se encarga). Guarda solo lo mínimo necesario de datos personales.
- Al final de cada fase, haz una revisión de seguridad del código nuevo y repórtame lo que encuentres.

## 5. Principios de diseño

- Limpio, simple y que inspire confianza. Mucho espacio en blanco, tipografía grande y legible, y una sola acción principal por pantalla.
- Mobile-first: la mayoría entrará desde el celular, muchas veces con datos móviles. Optimiza imágenes (next/image, WebP o AVIF) y busca Lighthouse de 90 o más en móvil.
- Lenguaje sencillo y cálido, en español hondureño neutro. Nada de tecnicismos: decir "pago inicial" en vez de "enganche"/"downpayment" según contexto, y explicar términos como "obra gris" o "escritura" con un tooltip.
- Paleta: un azul profundo para transmitir confianza, un acento cálido (terracota o arena) que evoque hogar y construcción, y fondos claros. Propón 2 o 3 opciones de paleta y tipografía antes de implementar.
- Botón flotante de WhatsApp en todas las páginas públicas: es el canal principal de esta comunidad.
- Accesibilidad AA: contraste suficiente, navegación con teclado, labels en formularios y botones grandes (mínimo 44px).
- Señales de confianza visibles en todo el sitio: fotos reales de obras, "pagos protegidos por etapas", datos legales de la empresa y equipo con cara y nombre.
- Precios siempre en USD, con el equivalente aproximado en lempiras como referencia.
- Estados vacíos, de carga y de error bien diseñados en cada pantalla.

## 6. Sitio público (secciones)

1. **Inicio**
   - Hero: mensaje central del tipo "Tu casa en Honduras, construida desde Estados Unidos. Ve cada avance, paga por etapas."
   - Cuatro tarjetas grandes con los cuatro caminos (Casa lista, Construir en mi terreno, Comprar terreno, Materiales).
   - "Cómo funciona" en 4 pasos visuales.
   - Calculadora "De remesa a patrimonio": el usuario pone cuánto envía al mes y ve en cuánto tiempo podría tener su casa o terreno. Es la herramienta de conversión más importante del sitio.
   - Bloque de confianza: obras entregadas, fotos de antes y después y garantías.
   - Testimonios (por ahora como componente con datos de ejemplo claramente marcados como tales; se reemplazan por testimonios reales).
   - Preguntas frecuentes y llamada final a la acción.
2. **Casas listas (catálogo)**
   - Filtros por departamento o ciudad, rango de precio, habitaciones, baños, estado (lista, en construcción, preventa) y metros cuadrados.
   - Vista de lista y vista de mapa.
   - Ficha de casa: galería, video o tour, características, plano, ubicación, precio, plan de pagos sugerido, documentos legales disponibles y botones de "Apartar", "Agendar videollamada" y "Preguntar por WhatsApp".
3. **Terrenos (catálogo)**
   - Filtros similares a los de casas, más servicios disponibles (agua, luz, acceso) y estado legal (escritura en regla).
   - Ficha con botón "Comprar terreno + construir mi casa" que conecta con el cotizador.
4. **Construir en mi terreno**
   - Catálogo de modelos de casa (diseños base) con planos, metros y rango de precio.
   - Cotizador paso a paso (wizard):
     1. ¿Tienes terreno? (Sí o No, y si es No, se enlaza a terrenos).
     2. Ubicación (departamento y municipio) y tamaño del terreno.
     3. Elige un modelo o pide un diseño personalizado.
     4. Nivel de acabados (básico, estándar o premium).
     5. Extras (muro perimetral, cisterna, paneles solares, etc.).
     6. Resultado: cotización estimada con desglose por etapas, plan de pagos y tiempo aproximado.
     7. Datos de contacto y agendar videollamada; además se guarda la cotización en su cuenta.
   - Las reglas de precio por modelo, acabado, departamento y extra se administran desde el panel de admin (no van fijas en el código).
5. **Tienda de materiales**
   - Catálogo por categorías (cemento, bloque, varilla, techo, eléctrico, plomería, acabados…).
   - Paquetes por etapa (ej. "Paquete cimentación", "Paquete techo", "Paquete obra gris") además de productos sueltos.
   - Carrito y checkout con dirección de entrega en Honduras y persona que recibe (nombre, teléfono e identidad).
   - Zonas de cobertura y costo de envío por departamento.
   - Seguimiento del pedido con evidencia de entrega (foto y nombre de quien recibió).
6. **Cómo funciona / Por qué confiar en nosotros**
   - Proceso completo explicado, pagos por etapas, contratos, garantías, aspectos legales (escrituras, poder notarial y registro de la propiedad) y la empresa y su equipo.
7. **Guías y blog**: contenido educativo (cómo comprar propiedad en Honduras desde el exterior, qué es un poder notarial, cómo verificar una escritura, etc.). Sirve para SEO y para generar confianza.
8. **Contacto**: formulario, WhatsApp, horario en hora de EE. UU. y de Honduras, y agendar videollamada.
9. **Páginas legales**: términos y condiciones, aviso de privacidad, política de reembolsos y política de pagos (como plantillas marcadas para revisión legal).

## 7. Portal del cliente (área privada)

Es lo que más distingue al producto. El migrante debe sentir que "está ahí" aunque esté lejos.

- Registro e inicio de sesión: email con magic link y opcionalmente Google. Teléfono con verificación por SMS como mejora futura.
- Mi panel: resumen de sus proyectos, pedidos, pagos próximos y mensajes.
- Mi proyecto (obra):
  - Línea de tiempo por etapas (ej. trámites, cimentación, paredes, techo, instalaciones, acabados, entrega), con porcentaje de avance.
  - Bitácora de avances: fotos y videos fechados que sube el gerente de proyecto (idealmente semanal), con comentarios.
  - Cronograma estimado contra el real.
  - Pagos: pagados, pendientes y próximos, ligados a cada etapa ("pagas cuando ves el avance").
  - Documentos: contrato, planos, presupuesto, facturas, escritura y permisos.
  - Mensajes con su gerente de proyecto (hilo dentro del proyecto) y acceso rápido a WhatsApp.
  - Invitar familiar autorizado en Honduras, con permisos de solo lectura y opción de confirmar entregas.
- Mis cotizaciones guardadas, con opción de convertirlas en proyecto.
- Mis pedidos de materiales con estado y evidencia de entrega.
- Mi perfil: datos personales, idioma, notificaciones y métodos de pago (vía Stripe).
- Notificaciones por email (y WhatsApp más adelante) cuando hay nuevo avance, pago próximo o entrega.

## 8. Panel de administración

- Leads/CRM simple: cotizaciones y contactos entrantes, con estado (nuevo, contactado, en negociación, ganado o perdido) y responsable asignado.
- Catálogos: CRUD de casas, terrenos, modelos, productos, paquetes, categorías y zonas de entrega, con subida de imágenes.
- Reglas del cotizador: precios por modelo, acabado, departamento y extras.
- Proyectos: crear proyecto desde una cotización, definir etapas y pagos, asignar gerente de proyecto, subir avances y documentos, y cambiar estado.
- Pedidos de materiales: gestión de estado, asignación a logística y carga de evidencia de entrega.
- Pagos: vista de pagos recibidos y pendientes, conciliada con Stripe.
- Usuarios y roles.
- Contenido: blog, preguntas frecuentes y testimonios.
- Métricas básicas: leads por semana, conversión del cotizador, proyectos activos y ventas de materiales.
- Bitácora de auditoría visible para el rol admin.

## 9. Fases de construcción

- **Fase 0 — Plan y base.** Preguntas, propuesta de arquitectura, modelo de datos (diagrama de tablas y relaciones), propuestas de paleta y tipografía, y setup del repo (Next.js, Tailwind, shadcn, Supabase, i18n, linter, tests y CI básico).
- **Fase 1 — Sitio público y captación (MVP).** Inicio, catálogos de casas y terrenos (lista, mapa y ficha), modelos, cotizador completo, calculadora de remesa a patrimonio, cómo funciona, preguntas frecuentes, contacto, WhatsApp y páginas legales. Los leads se guardan en la base de datos y llegan por email. Incluye SEO básico (metadata, sitemap, Open Graph).
- **Fase 2 — Cuentas, portal y admin.** Auth, roles, RLS, portal del cliente (proyecto, avances, documentos, mensajes y familiar autorizado) y panel de admin completo.
- **Fase 3 — Pagos y tienda.** Stripe (pagos por etapa, apartado de casa o terreno y checkout de materiales), webhooks, tienda de materiales con carrito, envíos por zona y seguimiento de pedidos.
- **Fase 4 — Pulido y lanzamiento.** Notificaciones por email, blog, analítica (respetando la privacidad), revisión de accesibilidad, rendimiento y seguridad, pruebas end-to-end de los flujos críticos y checklist de despliegue a producción.

## 10. Criterios de éxito

- Un migrante desde su celular puede, en menos de 3 minutos, obtener una cotización estimada de su casa y agendar una llamada.
- Un cliente con proyecto activo puede ver el último avance con fotos en 2 toques desde que entra.
- Ningún usuario puede ver datos de otro (comprobado con tests de RLS).
- Lighthouse móvil de 90 o más en rendimiento, accesibilidad y SEO en las páginas públicas.
- Todo el texto está traducido a español e inglés.

## 11. Datos del negocio

| Dato | Valor | Estado |
| --- | --- | --- |
| Nombre de la marca | ConstruFácil (en URLs, correos y código: `construfacil`) | Definido |
| Dominio | — | Pendiente |
| WhatsApp de ventas | — | Pendiente |
| Departamentos al inicio | Cortés, Francisco Morazán, Atlántida y Comayagua | Definido (24 nov 2026) |
| Constructora o socios en Honduras | — | Pendiente |
| Modelo de pagos | Por etapas contra avance: pago inicial y luego un pago por etapa. Sin intereses ni saldos en custodia. | Definido (24 nov 2026) |
| Entidad legal y país de facturación | — | Pendiente |

Otras decisiones tomadas el 24 nov 2026:

- "Agendar videollamada" en el MVP es una solicitud simple: el cliente elige día y franja horaria, se guarda en la base de datos y ventas confirma por WhatsApp.
- Todavía no existe proyecto de Supabase en la nube. Se desarrolla con migraciones SQL y Postgres local.
