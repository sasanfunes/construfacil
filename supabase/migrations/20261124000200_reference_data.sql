-- =====================================================================================
-- Datos de referencia: geografía de Honduras, tipo de cambio y ajustes de la plataforma.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Departamentos y municipios
-- -------------------------------------------------------------------------------------
create table public.departments (
  -- Código oficial del departamento (01 a 18). Es el mismo con el que empieza el DNI.
  id smallint primary key check (id between 1 and 18),
  iso_code text not null unique check (iso_code ~ '^HN-[A-Z]{2}$'),
  name text not null unique check (char_length(name) between 2 and 60),
  -- Activo = operamos ahí: sale en filtros, cotizador y zonas de envío.
  is_active boolean not null default false,
  latitude numeric(8, 5) not null check (latitude between 12.9 and 17.5),
  longitude numeric(8, 5) not null check (longitude between -89.4 and -83.1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger departments_set_updated_at
before update on public.departments
for each row execute function private.set_updated_at();

create table public.municipalities (
  id integer generated always as identity primary key,
  department_id smallint not null references public.departments (id) on delete restrict,
  name text not null check (char_length(name) between 2 and 80),
  is_active boolean not null default true,
  latitude numeric(8, 5) check (latitude between 12.9 and 17.5),
  longitude numeric(8, 5) check (longitude between -89.4 and -83.1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, name)
);

create index municipalities_department_idx on public.municipalities (department_id);

create trigger municipalities_set_updated_at
before update on public.municipalities
for each row execute function private.set_updated_at();

-- -------------------------------------------------------------------------------------
-- Tipo de cambio de referencia USD -> lempira. El precio oficial siempre es en USD.
-- Se conserva el historial: un cambio es una fila nueva, nunca una edición. Si una tasa se
-- registró mal, se corrige agregando otra para la misma fecha: vale la más reciente.
-- -------------------------------------------------------------------------------------
create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  -- Banda de cordura: el lempira ronda los 26 por dólar. Fuera de esto es un error de dedo.
  usd_to_hnl numeric(10, 4) not null check (usd_to_hnl between 10 and 100),
  effective_date date not null,
  source text not null check (char_length(source) between 1 and 200),
  is_example boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- La tasa vigente es la primera de este orden.
create index exchange_rates_current_idx on public.exchange_rates (effective_date desc, created_at desc);

create trigger exchange_rates_audit
after insert or update or delete on public.exchange_rates
for each row execute function private.audit_row_change('id');

-- -------------------------------------------------------------------------------------
-- Ajustes de la plataforma (llave -> valor). Los públicos los puede leer el sitio.
-- -------------------------------------------------------------------------------------
create table public.app_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.]{1,60}$'),
  value jsonb not null check (pg_column_size(value) <= 8192),
  is_public boolean not null default false,
  description text check (char_length(description) <= 300),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function private.set_updated_at();

-- Quién cambió el ajuste lo pone la base, no quien hace la petición.
create function private.stamp_updated_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

create trigger app_settings_stamp_updated_by
before insert or update on public.app_settings
for each row execute function private.stamp_updated_by();

create trigger app_settings_audit
after insert or update or delete on public.app_settings
for each row execute function private.audit_row_change('key');

-- =====================================================================================
-- Permisos y RLS
-- =====================================================================================

-- departments / municipalities: cualquiera lee, solo admin escribe -------------------
alter table public.departments enable row level security;
revoke all on table public.departments from anon, authenticated;
grant select on table public.departments to anon, authenticated;
grant update (name, is_active, latitude, longitude) on table public.departments to authenticated;
grant all on table public.departments to service_role;

create policy "departments_select_all"
on public.departments for select to anon, authenticated
using (true);

create policy "departments_update_admin"
on public.departments for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

alter table public.municipalities enable row level security;
revoke all on table public.municipalities from anon, authenticated;
grant select on table public.municipalities to anon, authenticated;
grant insert (department_id, name, is_active, latitude, longitude) on table public.municipalities to authenticated;
grant update (name, is_active, latitude, longitude) on table public.municipalities to authenticated;
grant all on table public.municipalities to service_role;

create policy "municipalities_select_all"
on public.municipalities for select to anon, authenticated
using (true);

create policy "municipalities_insert_admin"
on public.municipalities for insert to authenticated
with check ((select private.is_admin()));

create policy "municipalities_update_admin"
on public.municipalities for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

-- exchange_rates: cualquiera lee, solo admin agrega, nadie edita ni borra -------------
alter table public.exchange_rates enable row level security;
revoke all on table public.exchange_rates from anon, authenticated;
-- `created_by` no se expone por la API: quién registró cada tasa se consulta en audit_log.
grant select (id, usd_to_hnl, effective_date, source, is_example, created_at)
  on table public.exchange_rates to anon, authenticated;
grant insert (usd_to_hnl, effective_date, source, created_by) on table public.exchange_rates to authenticated;
-- Ni el servidor edita o borra el historial.
revoke all on table public.exchange_rates from service_role;
grant select, insert on table public.exchange_rates to service_role;

create policy "exchange_rates_select_all"
on public.exchange_rates for select to anon, authenticated
using (true);

create policy "exchange_rates_insert_admin"
on public.exchange_rates for insert to authenticated
with check (
  (select private.is_admin())
  and created_by = (select auth.uid())
  -- Solo tasas recientes: nada de fechas de hace años ni del futuro lejano.
  and effective_date between current_date - 7 and current_date + 1
);

-- app_settings: los públicos los lee cualquiera; el resto solo el equipo; escribe admin
alter table public.app_settings enable row level security;
revoke all on table public.app_settings from anon, authenticated;
-- Por columna: `updated_by` no se expone ni se puede escribir a mano.
grant select (key, value, is_public, updated_at) on table public.app_settings to anon;
grant select (key, value, is_public, description, updated_at) on table public.app_settings to authenticated;
grant insert (key, value, is_public, description) on table public.app_settings to authenticated;
grant update (value, is_public, description) on table public.app_settings to authenticated;
grant delete on table public.app_settings to authenticated;
revoke all on table public.app_settings from service_role;
grant select, insert, update, delete on table public.app_settings to service_role;

create policy "app_settings_select_public_or_staff"
on public.app_settings for select to anon, authenticated
using (is_public or (select private.is_staff()));

create policy "app_settings_insert_admin"
on public.app_settings for insert to authenticated
with check ((select private.is_admin()));

create policy "app_settings_update_admin"
on public.app_settings for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "app_settings_delete_admin"
on public.app_settings for delete to authenticated
using ((select private.is_admin()));

-- =====================================================================================
-- Datos: los 18 departamentos. Activos al inicio: Cortés, Francisco Morazán, Atlántida
-- y Comayagua. Las coordenadas son las de la cabecera departamental (aproximadas) y
-- solo sirven para centrar el mapa.
-- =====================================================================================
insert into public.departments (id, iso_code, name, is_active, latitude, longitude) values
  (1,  'HN-AT', 'Atlántida',         true,  15.75970, -86.78220),
  (2,  'HN-CL', 'Colón',             false, 15.91670, -85.95000),
  (3,  'HN-CM', 'Comayagua',         true,  14.46000, -87.65000),
  (4,  'HN-CP', 'Copán',             false, 14.76670, -88.78330),
  (5,  'HN-CR', 'Cortés',            true,  15.50420, -88.02500),
  (6,  'HN-CH', 'Choluteca',         false, 13.30000, -87.19000),
  (7,  'HN-EP', 'El Paraíso',        false, 13.94360, -86.84940),
  (8,  'HN-FM', 'Francisco Morazán', true,  14.07230, -87.19210),
  (9,  'HN-GD', 'Gracias a Dios',    false, 15.26670, -83.76670),
  (10, 'HN-IN', 'Intibucá',          false, 14.30000, -88.18330),
  (11, 'HN-IB', 'Islas de la Bahía', false, 16.31670, -86.53330),
  (12, 'HN-LP', 'La Paz',            false, 14.31670, -87.68330),
  (13, 'HN-LE', 'Lempira',           false, 14.58330, -88.58330),
  (14, 'HN-OC', 'Ocotepeque',        false, 14.43330, -89.18330),
  (15, 'HN-OL', 'Olancho',           false, 14.66670, -86.21940),
  (16, 'HN-SB', 'Santa Bárbara',     false, 14.91670, -88.23330),
  (17, 'HN-VA', 'Valle',             false, 13.53330, -87.48330),
  (18, 'HN-YO', 'Yoro',              false, 15.13330, -87.13330);

-- Municipios de los cuatro departamentos activos. Cortés y Atlántida van completos;
-- de Francisco Morazán y Comayagua van los principales (se agregan más desde el admin).
insert into public.municipalities (department_id, name, latitude, longitude) values
  -- Cortés (12 de 12)
  (5, 'San Pedro Sula',          15.50420, -88.02500),
  (5, 'Choloma',                 15.61440, -87.95300),
  (5, 'Villanueva',              15.31670, -88.00000),
  (5, 'Puerto Cortés',           15.82560, -87.92970),
  (5, 'La Lima',                 15.43330, -87.91670),
  (5, 'San Manuel',              15.33330, -87.91670),
  (5, 'Santa Cruz de Yojoa',     14.98330, -87.88330),
  (5, 'Omoa',                    15.76670, -88.03330),
  (5, 'Potrerillos',             15.23330, -87.96670),
  (5, 'Pimienta',                15.26670, -87.96670),
  (5, 'San Antonio de Cortés',   15.11670, -88.03330),
  (5, 'San Francisco de Yojoa',  15.01670, -87.96670),
  -- Francisco Morazán (principales)
  (8, 'Distrito Central',        14.07230, -87.19210),
  (8, 'Valle de Ángeles',        14.15000, -87.03330),
  (8, 'Santa Lucía',             14.11670, -87.11670),
  (8, 'Talanga',                 14.40000, -87.08330),
  (8, 'Santa Ana',               13.93330, -87.25000),
  (8, 'Ojojona',                 13.93330, -87.30000),
  (8, 'Sabanagrande',            13.80000, -87.25000),
  (8, 'Guaimaca',                14.53330, -86.81670),
  (8, 'Cedros',                  14.60000, -87.11670),
  (8, 'Cantarranas',             14.26670, -87.01670),
  (8, 'Tatumbla',                14.01670, -87.08330),
  (8, 'San Antonio de Oriente',  13.98330, -87.00000),
  -- Atlántida (8 de 8)
  (1, 'La Ceiba',                15.75970, -86.78220),
  (1, 'Tela',                    15.78330, -87.45000),
  (1, 'El Porvenir',             15.75000, -86.93330),
  (1, 'Jutiapa',                 15.76670, -86.51670),
  (1, 'La Masica',               15.61670, -87.11670),
  (1, 'San Francisco',           15.66670, -87.03330),
  (1, 'Arizona',                 15.63330, -87.31670),
  (1, 'Esparta',                 15.66670, -87.23330),
  -- Comayagua (principales)
  (3, 'Comayagua',               14.46000, -87.65000),
  (3, 'Siguatepeque',            14.60000, -87.83330),
  (3, 'La Libertad',             14.76670, -87.60000),
  (3, 'Villa de San Antonio',    14.31670, -87.61670),
  (3, 'Taulabé',                 14.68330, -87.96670),
  (3, 'Ajuterique',              14.38330, -87.70000),
  (3, 'Lejamaní',                14.36670, -87.70000),
  (3, 'San Jerónimo',            14.60000, -87.60000),
  (3, 'El Rosario',              14.58330, -87.75000),
  (3, 'Esquías',                 14.73330, -87.36670);
