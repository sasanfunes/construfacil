-- Datos de ejemplo para desarrollo. No se cargan en producción.
-- Todo lo que aparece aquí es un EJEMPLO y debe reemplazarse por datos reales antes del lanzamiento.

insert into public.exchange_rates (usd_to_hnl, effective_date, source, is_example) values
  (26.5000, date '2026-11-01', 'Valor de ejemplo. Reemplazar por la tasa de referencia del Banco Central de Honduras.', true)
on conflict (effective_date) do nothing;

insert into public.app_settings (key, value, is_public, description) values
  ('payments.initial_payment_percent', '20'::jsonb, true,
   'EJEMPLO. Porcentaje del pago inicial en el plan por etapas.'),
  ('company.legal_name', '"ConstruFácil (razón social por definir)"'::jsonb, true,
   'EJEMPLO. Razón social que aparece en el pie y en las páginas legales.'),
  ('company.support_hours', '{"timezone": "America/Tegucigalpa", "weekdays": "08:00-18:00", "saturday": "08:00-12:00"}'::jsonb, true,
   'EJEMPLO. Horario de atención en hora de Honduras.'),
  ('sales.lead_notification_note', '"Uso interno del equipo de ventas."'::jsonb, false,
   'EJEMPLO de ajuste privado: solo lo ve el equipo.')
on conflict (key) do nothing;
