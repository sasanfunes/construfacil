-- =====================================================================================
-- Fase 1 — Ubicación aproximada en el mapa público.
--
-- Las coordenadas de casas y terrenos se publican en el mapa. Con 5 decimales (~1 m) se
-- ubica el lote exacto: un riesgo para terrenos baldíos de dueños que viven en EE. UU.
-- (invasiones). Con 3 decimales (~110 m) se ve la zona, no el lote. La dirección exacta
-- se da en la videollamada.
--
-- Cambiar el tipo redondea los valores que ya existan.
-- =====================================================================================

alter table public.homes
  alter column latitude type numeric(5, 3),
  alter column longitude type numeric(6, 3);

alter table public.lots
  alter column latitude type numeric(5, 3),
  alter column longitude type numeric(6, 3);

comment on column public.homes.latitude is 'Latitud aproximada (3 decimales, ~110 m). Pública: nunca la del lote exacto.';
comment on column public.homes.longitude is 'Longitud aproximada (3 decimales, ~110 m). Pública: nunca la del lote exacto.';
comment on column public.lots.latitude is 'Latitud aproximada (3 decimales, ~110 m). Pública: nunca la del lote exacto.';
comment on column public.lots.longitude is 'Longitud aproximada (3 decimales, ~110 m). Pública: nunca la del lote exacto.';
