-- =====================================================================================
-- Fase 1 — Catálogo y reglas de precio.
--
-- Casas listas, terrenos, modelos de casa y las reglas del cotizador (acabados, factor
-- por departamento, extras y etapas de obra). Todo lo publicado se puede leer sin sesión;
-- solo un admin escribe. Cada cambio queda en audit_log (el brief pide auditar los
-- cambios de precio).
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Tipos
-- -------------------------------------------------------------------------------------
create type public.listing_status as enum (
  'draft',      -- borrador: solo lo ve el equipo
  'published',  -- a la venta
  'reserved',   -- apartada: se sigue mostrando con su etiqueta
  'sold'        -- vendida: ya no se muestra en el catálogo
);

create type public.construction_status as enum ('ready', 'under_construction', 'presale');

-- Situación legal del terreno en Honduras.
create type public.lot_legal_status as enum (
  'full_title',       -- dominio pleno: escritura inscrita en el Instituto de la Propiedad
  'useful_domain',    -- dominio útil: título municipal
  'title_in_process'  -- escritura en trámite
);

create type public.road_access as enum ('paved', 'gravel', 'dirt');
create type public.topography as enum ('flat', 'gentle_slope', 'steep');
create type public.pricing_unit as enum ('fixed', 'per_m2', 'per_linear_m', 'per_unit');

-- -------------------------------------------------------------------------------------
-- Utilidades
-- -------------------------------------------------------------------------------------

-- Para que un registro no pueda apuntar a un municipio de otro departamento.
alter table public.municipalities add constraint municipalities_id_department_key unique (id, department_id);

-- Características de una casa. La lista es cerrada porque cada una tiene su traducción.
create function private.is_valid_home_feature_list(features text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(features), 0) <= 30
    and features <@ array[
      'carport', 'covered_garage', 'patio', 'garden', 'terrace', 'laundry_area', 'service_room',
      'water_cistern', 'elevated_tank', 'solar_panels', 'water_heater', 'air_conditioning',
      'perimeter_wall', 'electric_gate', 'gated_community', 'pool', 'integrated_kitchen',
      'ceramic_floors', 'walk_in_closet', 'study'
    ]::text[];
$$;

-- La usa un CHECK, que corre con los permisos de quien escribe: el admin necesita ejecutarla.
grant execute on function private.is_valid_home_feature_list(text[]) to authenticated, service_role;

-- -------------------------------------------------------------------------------------
-- Etapas de obra. Sirven para el desglose de la cotización, el plan de pagos y, en la
-- Fase 2, para crear las etapas de cada proyecto.
-- -------------------------------------------------------------------------------------
create table public.stage_templates (
  key text primary key check (key ~ '^[a-z][a-z_]{1,39}$'),
  name_es text not null check (char_length(name_es) between 2 and 80),
  name_en text not null check (char_length(name_en) between 2 and 80),
  description_es text not null check (char_length(description_es) between 2 and 400),
  description_en text not null check (char_length(description_en) between 2 and 400),
  sort_order smallint not null unique,
  -- Partes del costo de obra y del tiempo, en puntos básicos (10000 = 100 %).
  -- El cálculo normaliza por la suma, así que no hace falta que sumen exactamente 10000.
  cost_share_bp integer not null check (cost_share_bp between 0 and 10000),
  duration_share_bp integer not null check (duration_share_bp between 0 and 10000),
  -- La etapa se paga con el pago inicial (p. ej. trámites y diseño).
  covered_by_initial_payment boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------------------------------
-- Modelos de casa (diseños base del cotizador)
-- -------------------------------------------------------------------------------------
create table public.house_models (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name_es text not null check (char_length(name_es) between 2 and 80),
  name_en text not null check (char_length(name_en) between 2 and 80),
  summary_es text not null check (char_length(summary_es) between 10 and 300),
  summary_en text not null check (char_length(summary_en) between 10 and 300),
  description_es text not null check (char_length(description_es) between 10 and 4000),
  description_en text not null check (char_length(description_en) between 10 and 4000),
  area_m2 numeric(7, 2) not null check (area_m2 > 0 and area_m2 < 5000),
  bedrooms smallint not null check (bedrooms between 0 and 20),
  bathrooms numeric(3, 1) not null check (bathrooms between 0 and 20 and bathrooms * 2 = floor(bathrooms * 2)),
  floors smallint not null check (floors between 1 and 5),
  min_lot_area_m2 numeric(9, 2) not null check (min_lot_area_m2 > 0),
  min_lot_front_m numeric(6, 2) check (min_lot_front_m > 0),
  build_weeks smallint not null check (build_weeks between 4 and 156),
  -- Precio con acabado estándar y factor de departamento 1.0.
  base_price_usd_cents bigint not null check (base_price_usd_cents > 0 and base_price_usd_cents < 100000000000),
  -- Distribución para dibujar el plano: [{ "room": "bedroom", "x": 0, "y": 0, "w": 3.2, "h": 3, "floor": 1 }]
  floor_plan jsonb not null default '[]'::jsonb
    check (jsonb_typeof(floor_plan) = 'array' and pg_column_size(floor_plan) <= 16384),
  is_active boolean not null default true,
  is_example boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------------------------------------------
-- Reglas de precio
-- -------------------------------------------------------------------------------------
create table public.finish_levels (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z_]{1,39}$'),
  name_es text not null check (char_length(name_es) between 2 and 60),
  name_en text not null check (char_length(name_en) between 2 and 60),
  description_es text not null check (char_length(description_es) between 2 and 400),
  description_en text not null check (char_length(description_en) between 2 and 400),
  -- Qué incluye, para mostrarlo como lista.
  includes_es text[] not null default '{}' check (cardinality(includes_es) <= 12),
  includes_en text[] not null default '{}' check (cardinality(includes_en) <= 12),
  price_multiplier numeric(5, 3) not null check (price_multiplier between 0.5 and 3),
  -- Para diseños personalizados (sin modelo): precio por m² con este acabado.
  custom_price_per_m2_usd_cents bigint not null check (custom_price_per_m2_usd_cents between 1000 and 10000000),
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.region_price_factors (
  department_id smallint primary key references public.departments (id) on delete cascade,
  -- Costo relativo de construir en el departamento (flete, mano de obra). 1.000 = referencia.
  factor numeric(5, 3) not null check (factor between 0.5 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_extras (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z_]{1,39}$'),
  name_es text not null check (char_length(name_es) between 2 and 80),
  name_en text not null check (char_length(name_en) between 2 and 80),
  description_es text not null check (char_length(description_es) between 2 and 300),
  description_en text not null check (char_length(description_en) between 2 and 300),
  pricing_unit public.pricing_unit not null,
  unit_price_usd_cents bigint not null check (unit_price_usd_cents > 0 and unit_price_usd_cents < 10000000000),
  min_quantity numeric(8, 2) not null default 1 check (min_quantity > 0),
  max_quantity numeric(8, 2) not null default 1 check (max_quantity >= min_quantity and max_quantity <= 10000),
  default_quantity numeric(8, 2) not null default 1,
  applies_region_factor boolean not null default true,
  -- En qué etapa de la obra se construye: su costo se suma a esa etapa.
  stage_key text not null references public.stage_templates (key) on update cascade,
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (default_quantity between min_quantity and max_quantity)
);

create index quote_extras_stage_key_idx on public.quote_extras (stage_key);

-- -------------------------------------------------------------------------------------
-- Casas listas
-- -------------------------------------------------------------------------------------
create table public.homes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  -- Código corto para hablar de la casa por WhatsApp: CF-C-012.
  code text not null unique check (code ~ '^CF-C-[0-9]{3,5}$'),
  title_es text not null check (char_length(title_es) between 3 and 120),
  title_en text not null check (char_length(title_en) between 3 and 120),
  summary_es text not null check (char_length(summary_es) between 10 and 300),
  summary_en text not null check (char_length(summary_en) between 10 and 300),
  description_es text not null check (char_length(description_es) between 10 and 4000),
  description_en text not null check (char_length(description_en) between 10 and 4000),
  department_id smallint not null references public.departments (id),
  municipality_id integer not null,
  neighborhood text check (char_length(neighborhood) between 2 and 120),
  -- Ubicación aproximada: suficiente para el mapa, no para dar con la puerta.
  latitude numeric(8, 5) check (latitude between 12.9 and 17.5),
  longitude numeric(8, 5) check (longitude between -89.4 and -83.1),
  construction_status public.construction_status not null,
  listing_status public.listing_status not null default 'draft',
  price_usd_cents bigint not null check (price_usd_cents > 0 and price_usd_cents < 100000000000),
  bedrooms smallint not null check (bedrooms between 0 and 20),
  bathrooms numeric(3, 1) not null check (bathrooms between 0 and 20 and bathrooms * 2 = floor(bathrooms * 2)),
  construction_area_m2 numeric(7, 2) not null check (construction_area_m2 > 0 and construction_area_m2 < 5000),
  lot_area_m2 numeric(9, 2) not null check (lot_area_m2 > 0 and lot_area_m2 < 1000000),
  floors smallint not null default 1 check (floors between 1 and 5),
  parking_spaces smallint not null default 0 check (parking_spaces between 0 and 20),
  features text[] not null default '{}' check (private.is_valid_home_feature_list(features)),
  house_model_id uuid references public.house_models (id) on delete set null,
  video_url text check (video_url ~ '^https://' and char_length(video_url) <= 500),
  tour_url text check (tour_url ~ '^https://' and char_length(tour_url) <= 500),
  estimated_delivery date,
  is_example boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (municipality_id, department_id) references public.municipalities (id, department_id)
);

create index homes_listing_status_idx on public.homes (listing_status);
create index homes_department_id_idx on public.homes (department_id);
create index homes_municipality_department_idx on public.homes (municipality_id, department_id);
create index homes_house_model_id_idx on public.homes (house_model_id);

-- -------------------------------------------------------------------------------------
-- Terrenos
-- -------------------------------------------------------------------------------------
create table public.lots (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  code text not null unique check (code ~ '^CF-T-[0-9]{3,5}$'),
  title_es text not null check (char_length(title_es) between 3 and 120),
  title_en text not null check (char_length(title_en) between 3 and 120),
  summary_es text not null check (char_length(summary_es) between 10 and 300),
  summary_en text not null check (char_length(summary_en) between 10 and 300),
  description_es text not null check (char_length(description_es) between 10 and 4000),
  description_en text not null check (char_length(description_en) between 10 and 4000),
  department_id smallint not null references public.departments (id),
  municipality_id integer not null,
  neighborhood text check (char_length(neighborhood) between 2 and 120),
  latitude numeric(8, 5) check (latitude between 12.9 and 17.5),
  longitude numeric(8, 5) check (longitude between -89.4 and -83.1),
  listing_status public.listing_status not null default 'draft',
  price_usd_cents bigint not null check (price_usd_cents > 0 and price_usd_cents < 100000000000),
  area_m2 numeric(10, 2) not null check (area_m2 > 0 and area_m2 < 10000000),
  front_m numeric(7, 2) check (front_m > 0),
  depth_m numeric(7, 2) check (depth_m > 0),
  has_water boolean not null default false,
  has_electricity boolean not null default false,
  has_sewer boolean not null default false,
  road_access public.road_access not null,
  legal_status public.lot_legal_status not null,
  topography public.topography not null,
  is_example boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (municipality_id, department_id) references public.municipalities (id, department_id)
);

create index lots_listing_status_idx on public.lots (listing_status);
create index lots_department_id_idx on public.lots (department_id);
create index lots_municipality_department_idx on public.lots (municipality_id, department_id);

-- -------------------------------------------------------------------------------------
-- updated_at y auditoría
-- -------------------------------------------------------------------------------------
create trigger stage_templates_set_updated_at before update on public.stage_templates
for each row execute function private.set_updated_at();
create trigger house_models_set_updated_at before update on public.house_models
for each row execute function private.set_updated_at();
create trigger finish_levels_set_updated_at before update on public.finish_levels
for each row execute function private.set_updated_at();
create trigger region_price_factors_set_updated_at before update on public.region_price_factors
for each row execute function private.set_updated_at();
create trigger quote_extras_set_updated_at before update on public.quote_extras
for each row execute function private.set_updated_at();
create trigger homes_set_updated_at before update on public.homes
for each row execute function private.set_updated_at();
create trigger lots_set_updated_at before update on public.lots
for each row execute function private.set_updated_at();

create trigger stage_templates_audit after insert or update or delete on public.stage_templates
for each row execute function private.audit_row_change('key');
create trigger house_models_audit after insert or update or delete on public.house_models
for each row execute function private.audit_row_change('id');
create trigger finish_levels_audit after insert or update or delete on public.finish_levels
for each row execute function private.audit_row_change('id');
create trigger region_price_factors_audit after insert or update or delete on public.region_price_factors
for each row execute function private.audit_row_change('department_id');
create trigger quote_extras_audit after insert or update or delete on public.quote_extras
for each row execute function private.audit_row_change('id');
create trigger homes_audit after insert or update or delete on public.homes
for each row execute function private.audit_row_change('id');
create trigger lots_audit after insert or update or delete on public.lots
for each row execute function private.audit_row_change('id');

-- =====================================================================================
-- Permisos y RLS
--
-- Lectura: cualquiera ve lo publicado o activo; el equipo de ventas y admin ven todo.
-- Escritura: solo admin. El servidor (service_role) no tiene TRUNCATE en tablas auditadas.
-- =====================================================================================

-- stage_templates --------------------------------------------------------------------
alter table public.stage_templates enable row level security;
revoke all on table public.stage_templates from anon, authenticated, service_role;
grant select on table public.stage_templates to anon, authenticated;
grant insert, update, delete on table public.stage_templates to authenticated;
grant select, insert, update, delete on table public.stage_templates to service_role;

create policy "stage_templates_select_all" on public.stage_templates for select to anon, authenticated
using (true);
create policy "stage_templates_insert_admin" on public.stage_templates for insert to authenticated
with check ((select private.is_admin()));
create policy "stage_templates_update_admin" on public.stage_templates for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "stage_templates_delete_admin" on public.stage_templates for delete to authenticated
using ((select private.is_admin()));

-- house_models -----------------------------------------------------------------------
alter table public.house_models enable row level security;
revoke all on table public.house_models from anon, authenticated, service_role;
grant select on table public.house_models to anon, authenticated;
grant insert, update, delete on table public.house_models to authenticated;
grant select, insert, update, delete on table public.house_models to service_role;

create policy "house_models_select_active_or_staff" on public.house_models for select to anon, authenticated
using (is_active or (select private.has_role('ventas', 'admin')));
create policy "house_models_insert_admin" on public.house_models for insert to authenticated
with check ((select private.is_admin()));
create policy "house_models_update_admin" on public.house_models for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "house_models_delete_admin" on public.house_models for delete to authenticated
using ((select private.is_admin()));

-- finish_levels ----------------------------------------------------------------------
alter table public.finish_levels enable row level security;
revoke all on table public.finish_levels from anon, authenticated, service_role;
grant select on table public.finish_levels to anon, authenticated;
grant insert, update, delete on table public.finish_levels to authenticated;
grant select, insert, update, delete on table public.finish_levels to service_role;

create policy "finish_levels_select_active_or_staff" on public.finish_levels for select to anon, authenticated
using (is_active or (select private.has_role('ventas', 'admin')));
create policy "finish_levels_insert_admin" on public.finish_levels for insert to authenticated
with check ((select private.is_admin()));
create policy "finish_levels_update_admin" on public.finish_levels for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "finish_levels_delete_admin" on public.finish_levels for delete to authenticated
using ((select private.is_admin()));

-- region_price_factors ---------------------------------------------------------------
alter table public.region_price_factors enable row level security;
revoke all on table public.region_price_factors from anon, authenticated, service_role;
grant select on table public.region_price_factors to anon, authenticated;
grant insert, update, delete on table public.region_price_factors to authenticated;
grant select, insert, update, delete on table public.region_price_factors to service_role;

create policy "region_price_factors_select_all" on public.region_price_factors for select to anon, authenticated
using (true);
create policy "region_price_factors_insert_admin" on public.region_price_factors for insert to authenticated
with check ((select private.is_admin()));
create policy "region_price_factors_update_admin" on public.region_price_factors for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "region_price_factors_delete_admin" on public.region_price_factors for delete to authenticated
using ((select private.is_admin()));

-- quote_extras -----------------------------------------------------------------------
alter table public.quote_extras enable row level security;
revoke all on table public.quote_extras from anon, authenticated, service_role;
grant select on table public.quote_extras to anon, authenticated;
grant insert, update, delete on table public.quote_extras to authenticated;
grant select, insert, update, delete on table public.quote_extras to service_role;

create policy "quote_extras_select_active_or_staff" on public.quote_extras for select to anon, authenticated
using (is_active or (select private.has_role('ventas', 'admin')));
create policy "quote_extras_insert_admin" on public.quote_extras for insert to authenticated
with check ((select private.is_admin()));
create policy "quote_extras_update_admin" on public.quote_extras for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "quote_extras_delete_admin" on public.quote_extras for delete to authenticated
using ((select private.is_admin()));

-- homes ------------------------------------------------------------------------------
alter table public.homes enable row level security;
revoke all on table public.homes from anon, authenticated, service_role;
grant select on table public.homes to anon, authenticated;
grant insert, update, delete on table public.homes to authenticated;
grant select, insert, update, delete on table public.homes to service_role;

-- Público: a la venta o apartadas. Borradores y vendidas solo para el equipo.
create policy "homes_select_listed_or_staff" on public.homes for select to anon, authenticated
using (listing_status in ('published', 'reserved') or (select private.has_role('ventas', 'admin')));
create policy "homes_insert_admin" on public.homes for insert to authenticated
with check ((select private.is_admin()));
create policy "homes_update_admin" on public.homes for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "homes_delete_admin" on public.homes for delete to authenticated
using ((select private.is_admin()));

-- lots -------------------------------------------------------------------------------
alter table public.lots enable row level security;
revoke all on table public.lots from anon, authenticated, service_role;
grant select on table public.lots to anon, authenticated;
grant insert, update, delete on table public.lots to authenticated;
grant select, insert, update, delete on table public.lots to service_role;

create policy "lots_select_listed_or_staff" on public.lots for select to anon, authenticated
using (listing_status in ('published', 'reserved') or (select private.has_role('ventas', 'admin')));
create policy "lots_insert_admin" on public.lots for insert to authenticated
with check ((select private.is_admin()));
create policy "lots_update_admin" on public.lots for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "lots_delete_admin" on public.lots for delete to authenticated
using ((select private.is_admin()));
