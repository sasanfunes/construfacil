-- =====================================================================================
-- Fase 1 — Captación: leads, solicitudes de videollamada, cotizaciones y embudo.
--
-- Nadie entra a estas tablas por la API sin sesión. Los formularios públicos escriben a
-- través del servidor, que valida con Zod, aplica rate limiting y llama a las funciones
-- submit_lead() y submit_quote(). Esas funciones escriben todo en una sola transacción.
-- El equipo de ventas y admin leen; ventas actualiza el estado y el responsable.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Tipos
-- -------------------------------------------------------------------------------------
create type public.lead_source as enum (
  'quote',                -- guardó una cotización
  'contact',              -- formulario de contacto
  'video_call',           -- pidió una videollamada
  'reservation_request',  -- quiere apartar una casa o terreno
  'listing_inquiry'       -- preguntó por una casa o terreno
);

create type public.lead_status as enum ('new', 'contacted', 'negotiating', 'won', 'lost');
create type public.contact_channel as enum ('whatsapp', 'phone', 'email');
create type public.time_slot as enum ('morning', 'afternoon', 'evening');
create type public.video_call_status as enum ('requested', 'confirmed', 'completed', 'cancelled');
create type public.quote_land_status as enum (
  'own',             -- ya tiene terreno
  'buying_from_us',  -- compra uno de nuestros terrenos
  'not_yet'          -- todavía no tiene: le ayudamos a buscar
);

-- -------------------------------------------------------------------------------------
-- Leads
-- -------------------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  source public.lead_source not null,
  status public.lead_status not null default 'new',
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone ~ '^\+?[0-9]{8,15}$'),
  preferred_channel public.contact_channel not null default 'whatsapp',
  locale text not null check (locale in ('es', 'en')),
  us_state text check (us_state ~ '^[A-Z]{2}$'),
  message text check (char_length(message) <= 2000),
  home_id uuid references public.homes (id) on delete set null,
  lot_id uuid references public.lots (id) on delete set null,
  house_model_id uuid references public.house_models (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  privacy_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.leads is 'Contactos entrantes. Datos personales: solo los necesarios para responder.';

create index leads_status_created_at_idx on public.leads (status, created_at desc);
create index leads_email_idx on public.leads (lower(email));
create index leads_home_id_idx on public.leads (home_id);
create index leads_lot_id_idx on public.leads (lot_id);
create index leads_house_model_id_idx on public.leads (house_model_id);
create index leads_assigned_to_idx on public.leads (assigned_to);

create trigger leads_set_updated_at before update on public.leads
for each row execute function private.set_updated_at();

-- -------------------------------------------------------------------------------------
-- Solicitudes de videollamada (solicitud simple: ventas confirma por WhatsApp)
-- -------------------------------------------------------------------------------------
create table public.video_call_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  preferred_date date not null,
  time_slot public.time_slot not null,
  -- Zona horaria de quien pide la llamada (IANA), para que ventas no se equivoque de hora.
  timezone text not null check (char_length(timezone) <= 64 and timezone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$'),
  status public.video_call_status not null default 'requested',
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index video_call_requests_lead_id_idx on public.video_call_requests (lead_id);
create index video_call_requests_status_date_idx on public.video_call_requests (status, preferred_date);
create index video_call_requests_confirmed_by_idx on public.video_call_requests (confirmed_by);

create trigger video_call_requests_set_updated_at before update on public.video_call_requests
for each row execute function private.set_updated_at();

-- Quién confirmó y cuándo lo pone la base.
create function private.stamp_video_call_confirmation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    new.confirmed_at := now();
    new.confirmed_by := (select auth.uid());
  end if;
  return new;
end;
$$;

create trigger video_call_requests_stamp_confirmation before update on public.video_call_requests
for each row execute function private.stamp_video_call_confirmation();

-- -------------------------------------------------------------------------------------
-- Cotizaciones. Son una foto: guardan los precios y el tipo de cambio del momento, así un
-- cambio posterior de reglas no altera lo que ya se le dijo al cliente.
-- -------------------------------------------------------------------------------------
create function private.new_quote_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'CF-Q-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;

-- Es el valor por defecto de quotes.code: lo ejecuta quien inserta (solo el servidor).
grant execute on function private.new_quote_code() to service_role;

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default private.new_quote_code() check (code ~ '^CF-Q-[0-9A-F]{6}$'),
  lead_id uuid not null references public.leads (id) on delete cascade,
  -- El enlace privado lleva un token; aquí solo se guarda su SHA-256.
  access_token_hash text not null unique check (access_token_hash ~ '^[0-9a-f]{64}$'),
  locale text not null check (locale in ('es', 'en')),
  land_status public.quote_land_status not null,
  lot_id uuid references public.lots (id) on delete restrict,
  department_id smallint not null references public.departments (id),
  municipality_id integer,
  land_area_m2 numeric(10, 2) check (land_area_m2 > 0 and land_area_m2 < 10000000),
  house_model_id uuid references public.house_models (id) on delete restrict,
  custom_area_m2 numeric(7, 2) check (custom_area_m2 between 20 and 2000),
  finish_level_id uuid not null references public.finish_levels (id) on delete restrict,
  construction_usd_cents bigint not null check (construction_usd_cents > 0),
  extras_usd_cents bigint not null check (extras_usd_cents >= 0),
  total_usd_cents bigint not null check (total_usd_cents > 0),
  lot_price_usd_cents bigint check (lot_price_usd_cents > 0),
  initial_payment_percent numeric(5, 2) not null check (initial_payment_percent between 0 and 100),
  duration_weeks smallint not null check (duration_weeks between 1 and 260),
  -- Desglose por etapas y plan de pagos, tal como se calcularon.
  breakdown jsonb not null check (jsonb_typeof(breakdown) = 'object' and pg_column_size(breakdown) <= 32768),
  usd_to_hnl numeric(10, 4) not null check (usd_to_hnl between 10 and 100),
  valid_until date not null,
  access_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (municipality_id, department_id) references public.municipalities (id, department_id),
  check ((house_model_id is null) <> (custom_area_m2 is null)),
  check ((land_status = 'buying_from_us') = (lot_id is not null)),
  check ((lot_id is null) = (lot_price_usd_cents is null)),
  check (total_usd_cents = construction_usd_cents + extras_usd_cents)
);

create index quotes_lead_id_idx on public.quotes (lead_id);
create index quotes_lot_id_idx on public.quotes (lot_id);
create index quotes_house_model_id_idx on public.quotes (house_model_id);
create index quotes_finish_level_id_idx on public.quotes (finish_level_id);
create index quotes_department_id_idx on public.quotes (department_id);
create index quotes_municipality_department_idx on public.quotes (municipality_id, department_id);
create index quotes_created_at_idx on public.quotes (created_at desc);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  extra_id uuid not null references public.quote_extras (id) on delete restrict,
  quantity numeric(8, 2) not null check (quantity > 0),
  unit_price_usd_cents bigint not null check (unit_price_usd_cents > 0),
  total_usd_cents bigint not null check (total_usd_cents > 0),
  unique (quote_id, extra_id)
);

create index quote_items_extra_id_idx on public.quote_items (extra_id);

-- -------------------------------------------------------------------------------------
-- Embudo del cotizador: eventos anónimos, sin datos personales. El identificador de
-- sesión es aleatorio por pestaña y no se cruza con ningún lead.
-- -------------------------------------------------------------------------------------
create table public.funnel_events (
  id bigint generated always as identity primary key,
  event text not null check (event in (
    'quote_started', 'quote_step_viewed', 'quote_estimate_viewed', 'quote_saved', 'calculator_used'
  )),
  step smallint check (step between 1 and 10),
  session_id uuid not null,
  locale text not null check (locale in ('es', 'en')),
  occurred_at timestamptz not null default now()
);

create index funnel_events_event_occurred_at_idx on public.funnel_events (event, occurred_at desc);

-- Índices de llaves foráneas de la Fase 0 que faltaban.
create index user_roles_assigned_by_idx on public.user_roles (assigned_by);
create index exchange_rates_created_by_idx on public.exchange_rates (created_by);
create index app_settings_updated_by_idx on public.app_settings (updated_by);

-- =====================================================================================
-- Altas atómicas. Las llama solo el servidor (service_role), después de validar.
-- =====================================================================================

-- Inserta el lead y, si viene, su solicitud de videollamada. Devuelve el id del lead.
create function public.submit_lead(p_lead jsonb, p_video_call jsonb default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead_id uuid;
  v_date date;
begin
  insert into public.leads (
    source, full_name, email, phone, preferred_channel, locale, us_state, message,
    home_id, lot_id, house_model_id, privacy_accepted_at
  )
  values (
    (p_lead ->> 'source')::public.lead_source,
    p_lead ->> 'full_name',
    lower(p_lead ->> 'email'),
    nullif(p_lead ->> 'phone', ''),
    coalesce(nullif(p_lead ->> 'preferred_channel', ''), 'whatsapp')::public.contact_channel,
    p_lead ->> 'locale',
    nullif(p_lead ->> 'us_state', ''),
    nullif(p_lead ->> 'message', ''),
    nullif(p_lead ->> 'home_id', '')::uuid,
    nullif(p_lead ->> 'lot_id', '')::uuid,
    nullif(p_lead ->> 'house_model_id', '')::uuid,
    now()
  )
  returning id into v_lead_id;

  if p_video_call is not null and jsonb_typeof(p_video_call) = 'object' then
    v_date := (p_video_call ->> 'preferred_date')::date;
    -- Desde mañana y hasta 60 días. (Hoy no: ventas necesita tiempo para confirmar.)
    if v_date < current_date + 1 or v_date > current_date + 60 then
      raise exception 'Fecha de videollamada fuera de rango' using errcode = 'check_violation';
    end if;
    insert into public.video_call_requests (lead_id, preferred_date, time_slot, timezone)
    values (v_lead_id, v_date, (p_video_call ->> 'time_slot')::public.time_slot, p_video_call ->> 'timezone');
  end if;

  return v_lead_id;
end;
$$;

-- Inserta lead, cotización, extras y videollamada en una sola transacción.
create function public.submit_quote(p_lead jsonb, p_quote jsonb, p_items jsonb, p_video_call jsonb default null)
returns table (quote_id uuid, quote_code text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead_id uuid;
  v_quote_id uuid;
  v_code text;
  v_department smallint := (p_quote ->> 'department_id')::smallint;
  v_model uuid := nullif(p_quote ->> 'house_model_id', '')::uuid;
  v_finish uuid := (p_quote ->> 'finish_level_id')::uuid;
  v_lot uuid := nullif(p_quote ->> 'lot_id', '')::uuid;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'p_items debe ser una lista' using errcode = 'invalid_parameter_value';
  end if;

  -- Defensa adicional: el servidor ya validó contra el catálogo, pero aquí no se acepta
  -- nada inactivo ni de un departamento donde no operamos.
  if not exists (select 1 from public.departments d where d.id = v_department and d.is_active) then
    raise exception 'Departamento no disponible' using errcode = 'check_violation';
  end if;
  if v_model is not null and not exists (select 1 from public.house_models m where m.id = v_model and m.is_active) then
    raise exception 'Modelo no disponible' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.finish_levels f where f.id = v_finish and f.is_active) then
    raise exception 'Acabado no disponible' using errcode = 'check_violation';
  end if;
  if v_lot is not null and not exists (
    select 1 from public.lots l where l.id = v_lot and l.listing_status = 'published'
  ) then
    raise exception 'Terreno no disponible' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where not exists (
      select 1 from public.quote_extras e where e.id = (item ->> 'extra_id')::uuid and e.is_active
    )
  ) then
    raise exception 'Extra no disponible' using errcode = 'check_violation';
  end if;

  v_lead_id := public.submit_lead(p_lead || jsonb_build_object('source', 'quote'), p_video_call);

  insert into public.quotes (
    lead_id, access_token_hash, locale, land_status, lot_id, department_id, municipality_id,
    land_area_m2, house_model_id, custom_area_m2, finish_level_id, construction_usd_cents,
    extras_usd_cents, total_usd_cents, lot_price_usd_cents, initial_payment_percent,
    duration_weeks, breakdown, usd_to_hnl, valid_until, access_expires_at
  )
  values (
    v_lead_id,
    p_quote ->> 'access_token_hash',
    p_quote ->> 'locale',
    (p_quote ->> 'land_status')::public.quote_land_status,
    v_lot,
    v_department,
    nullif(p_quote ->> 'municipality_id', '')::integer,
    nullif(p_quote ->> 'land_area_m2', '')::numeric,
    v_model,
    nullif(p_quote ->> 'custom_area_m2', '')::numeric,
    v_finish,
    (p_quote ->> 'construction_usd_cents')::bigint,
    (p_quote ->> 'extras_usd_cents')::bigint,
    (p_quote ->> 'total_usd_cents')::bigint,
    nullif(p_quote ->> 'lot_price_usd_cents', '')::bigint,
    (p_quote ->> 'initial_payment_percent')::numeric,
    (p_quote ->> 'duration_weeks')::smallint,
    p_quote -> 'breakdown',
    (p_quote ->> 'usd_to_hnl')::numeric,
    current_date + 30,
    now() + interval '180 days'
  )
  returning id, code into v_quote_id, v_code;

  insert into public.quote_items (quote_id, extra_id, quantity, unit_price_usd_cents, total_usd_cents)
  select
    v_quote_id,
    (item ->> 'extra_id')::uuid,
    (item ->> 'quantity')::numeric,
    (item ->> 'unit_price_usd_cents')::bigint,
    (item ->> 'total_usd_cents')::bigint
  from jsonb_array_elements(p_items) item;

  return query select v_quote_id, v_code;
end;
$$;

revoke execute on function public.submit_lead(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.submit_quote(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.submit_lead(jsonb, jsonb) to service_role;
grant execute on function public.submit_quote(jsonb, jsonb, jsonb, jsonb) to service_role;

-- =====================================================================================
-- Permisos y RLS
-- =====================================================================================

-- leads ------------------------------------------------------------------------------
alter table public.leads enable row level security;
revoke all on table public.leads from anon, authenticated, service_role;
grant select on table public.leads to authenticated;
grant update (status, assigned_to) on table public.leads to authenticated;
-- El servidor puede borrar, para atender una solicitud de eliminación de datos.
grant select, insert, update, delete on table public.leads to service_role;

create policy "leads_select_sales_admin" on public.leads for select to authenticated
using ((select private.has_role('ventas', 'admin')));

-- Solo se puede asignar a alguien del equipo.
create policy "leads_update_sales_admin" on public.leads for update to authenticated
using ((select private.has_role('ventas', 'admin')))
with check (
  (select private.has_role('ventas', 'admin'))
  and (assigned_to is null or private.user_is_staff(assigned_to))
);

-- video_call_requests ----------------------------------------------------------------
alter table public.video_call_requests enable row level security;
revoke all on table public.video_call_requests from anon, authenticated, service_role;
grant select (id, lead_id, preferred_date, time_slot, timezone, status, confirmed_at, created_at, updated_at)
  on table public.video_call_requests to authenticated;
grant update (status) on table public.video_call_requests to authenticated;
grant select, insert, update, delete on table public.video_call_requests to service_role;

create policy "video_call_requests_select_sales_admin" on public.video_call_requests for select to authenticated
using ((select private.has_role('ventas', 'admin')));
create policy "video_call_requests_update_sales_admin" on public.video_call_requests for update to authenticated
using ((select private.has_role('ventas', 'admin')))
with check ((select private.has_role('ventas', 'admin')));

-- quotes y quote_items: solo lectura para el equipo; nadie las edita ----------------
alter table public.quotes enable row level security;
revoke all on table public.quotes from anon, authenticated, service_role;
-- El hash del token no se expone: con él no se puede abrir el enlace, pero no le sirve a nadie.
grant select (
  id, code, lead_id, locale, land_status, lot_id, department_id, municipality_id, land_area_m2,
  house_model_id, custom_area_m2, finish_level_id, construction_usd_cents, extras_usd_cents,
  total_usd_cents, lot_price_usd_cents, initial_payment_percent, duration_weeks, breakdown,
  usd_to_hnl, valid_until, access_expires_at, created_at
) on table public.quotes to authenticated;
grant select, insert, delete on table public.quotes to service_role;

create policy "quotes_select_sales_admin" on public.quotes for select to authenticated
using ((select private.has_role('ventas', 'admin')));

alter table public.quote_items enable row level security;
revoke all on table public.quote_items from anon, authenticated, service_role;
grant select on table public.quote_items to authenticated;
grant select, insert, delete on table public.quote_items to service_role;

create policy "quote_items_select_sales_admin" on public.quote_items for select to authenticated
using ((select private.has_role('ventas', 'admin')));

-- funnel_events ----------------------------------------------------------------------
alter table public.funnel_events enable row level security;
revoke all on table public.funnel_events from anon, authenticated, service_role;
grant select on table public.funnel_events to authenticated;
grant select, delete on table public.funnel_events to service_role;
grant insert (event, step, session_id, locale) on table public.funnel_events to service_role;

create policy "funnel_events_select_sales_admin" on public.funnel_events for select to authenticated
using ((select private.has_role('ventas', 'admin')));
