-- =====================================================================================
-- Construir: proyectos de construcción.
--
-- 1. Catálogo de sistemas y materiales por etapa de obra (cimentación, obra gris, techos
--    y acabados), más diseño y trámites. Es público, como el resto del catálogo; solo un
--    admin escribe y cada cambio de precio queda en audit_log.
-- 2. Proyectos que el cliente arma en el onboarding. Privados: los escribe solo el
--    servidor (después de validar y recalcular) y los lee el equipo de ventas y admin.
--    El cliente entra con un enlace privado; aquí solo se guarda el SHA-256 del token.
-- 3. Solicitudes desde el panel del proyecto (servicios, pruebas de avance, soporte).
--
-- El cotizador de la Fase 1 (quotes, finish_levels, quote_extras, stage_templates) queda
-- como legado: sus cotizaciones guardadas se conservan.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Tipos
-- -------------------------------------------------------------------------------------
create type public.build_option_stage as enum (
  'preliminary',  -- diseño y trámites: se paga con el pago inicial
  'foundation',   -- cimentación
  'grey_work',    -- obra gris
  'roof',         -- techos
  'finishes'      -- acabados
);

create type public.option_pricing_basis as enum (
  'construction_m2',  -- metros de construcción (todas las plantas)
  'footprint_m2',     -- metros de la planta baja
  'upper_floor_m2',   -- metros de la planta alta
  'per_bathroom',     -- por baño
  'fixed'             -- una sola vez
);

create type public.project_land_status as enum ('own', 'buying_from_us', 'skipped');
create type public.project_design_source as enum ('own_plans', 'custom', 'catalog');
create type public.project_status as enum ('draft', 'in_review', 'active', 'closed');
create type public.project_request_kind as enum ('service', 'progress_proof', 'support');
create type public.project_request_status as enum ('open', 'in_progress', 'done');

alter type public.lead_source add value if not exists 'project';

-- -------------------------------------------------------------------------------------
-- Categorías de opciones. Lista cerrada: cada una tiene su nombre traducido y su lugar en
-- el onboarding. Debe coincidir con OPTION_CATEGORIES en src/features/projects/types.ts.
-- -------------------------------------------------------------------------------------
create function private.construction_category_stage(category text)
returns public.build_option_stage
language sql
immutable
set search_path = ''
as $$
  select (case category
    when 'design' then 'preliminary'
    when 'permits' then 'preliminary'
    when 'structure' then 'foundation'
    when 'footing_waterproofing' then 'foundation'
    when 'ground_slab' then 'foundation'
    when 'walls' then 'grey_work'
    when 'upper_slab' then 'grey_work'
    when 'rough_installations' then 'grey_work'
    when 'roof_structure' then 'roof'
    when 'roof_cover' then 'roof'
    when 'roof_insulation' then 'roof'
    when 'ceiling' then 'roof'
    when 'floors' then 'finishes'
    when 'doors' then 'finishes'
    when 'windows' then 'finishes'
    when 'bathrooms' then 'finishes'
    when 'kitchen' then 'finishes'
    when 'paint_lighting' then 'finishes'
  end)::public.build_option_stage;
$$;

-- La usa un CHECK, que corre con los permisos de quien escribe.
grant execute on function private.construction_category_stage(text) to authenticated, service_role;

-- -------------------------------------------------------------------------------------
-- Catálogo de opciones
-- -------------------------------------------------------------------------------------
create table public.construction_options (
  id uuid primary key default gen_random_uuid(),
  stage public.build_option_stage not null,
  category text not null check (category ~ '^[a-z][a-z_]{1,39}$'),
  key text not null check (key ~ '^[a-z][a-z_]{1,39}$'),
  name_es text not null check (char_length(name_es) between 2 and 80),
  name_en text not null check (char_length(name_en) between 2 and 80),
  description_es text not null check (char_length(description_es) between 2 and 300),
  description_en text not null check (char_length(description_en) between 2 and 300),
  pricing_basis public.option_pricing_basis not null,
  unit_price_usd_cents bigint not null check (unit_price_usd_cents >= 0 and unit_price_usd_cents < 10000000000),
  -- Parte del costo que son materiales (10000 = 100 %); el resto es mano de obra.
  materials_share_bp integer not null check (materials_share_bp between 0 and 10000),
  -- Semanas por cada 100 m², por baño o fijas, según la base de precio.
  weeks_factor numeric(5, 2) not null check (weeks_factor between 0 and 52),
  is_default boolean not null default false,
  is_active boolean not null default true,
  is_example boolean not null default false,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, key),
  -- Para que una selección no pueda apuntar a una opción de otra categoría.
  unique (id, category),
  check (
    private.construction_category_stage(category) is not null
    and stage = private.construction_category_stage(category)
  )
);

comment on table public.construction_options is 'Sistemas y materiales por etapa de obra, con su precio de referencia.';

-- Una sola opción por defecto por categoría.
create unique index construction_options_one_default_idx on public.construction_options (category) where is_default;

create trigger construction_options_set_updated_at before update on public.construction_options
for each row execute function private.set_updated_at();
create trigger construction_options_audit after insert or update or delete on public.construction_options
for each row execute function private.audit_row_change('id');

-- -------------------------------------------------------------------------------------
-- Proyectos
-- -------------------------------------------------------------------------------------
create function private.new_project_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'CF-P-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;

grant execute on function private.new_project_code() to service_role;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default private.new_project_code() check (code ~ '^CF-P-[0-9A-F]{6}$'),
  lead_id uuid not null references public.leads (id) on delete cascade,
  access_token_hash text not null unique check (access_token_hash ~ '^[0-9a-f]{64}$'),
  access_expires_at timestamptz not null,
  name text not null check (char_length(name) between 2 and 80),
  locale text not null check (locale in ('es', 'en')),
  status public.project_status not null default 'draft',
  land_status public.project_land_status not null,
  lot_id uuid references public.lots (id) on delete restrict,
  department_id smallint references public.departments (id),
  municipality_id integer,
  land_area_m2 numeric(10, 2) check (land_area_m2 > 0 and land_area_m2 < 10000000),
  design_source public.project_design_source not null,
  house_model_id uuid references public.house_models (id) on delete restrict,
  area_m2 numeric(7, 2) not null check (area_m2 between 20 and 2000),
  floors smallint not null check (floors between 1 and 2),
  bedrooms smallint not null check (bedrooms between 0 and 10),
  bathrooms smallint not null check (bathrooms between 1 and 10),
  -- Foto de lo calculado: un cambio posterior de precios no altera lo que se le mostró.
  preliminary_usd_cents bigint not null check (preliminary_usd_cents >= 0),
  construction_usd_cents bigint not null check (construction_usd_cents > 0),
  total_usd_cents bigint not null check (total_usd_cents > 0),
  lot_price_usd_cents bigint check (lot_price_usd_cents > 0),
  duration_weeks smallint not null check (duration_weeks between 1 and 520),
  breakdown jsonb not null check (jsonb_typeof(breakdown) = 'object' and pg_column_size(breakdown) <= 65536),
  usd_to_hnl numeric(10, 4) not null check (usd_to_hnl between 10 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (municipality_id, department_id) references public.municipalities (id, department_id),
  check (municipality_id is null or department_id is not null),
  check ((land_status = 'buying_from_us') = (lot_id is not null)),
  check ((lot_id is null) = (lot_price_usd_cents is null)),
  check (land_status <> 'own' or department_id is not null),
  check ((design_source = 'catalog') = (house_model_id is not null)),
  check (total_usd_cents = preliminary_usd_cents + construction_usd_cents)
);

comment on table public.projects is 'Proyectos de construcción que arma el cliente. El cliente entra con un enlace privado.';

create index projects_lead_id_idx on public.projects (lead_id);
create index projects_lot_id_idx on public.projects (lot_id);
create index projects_department_id_idx on public.projects (department_id);
create index projects_municipality_department_idx on public.projects (municipality_id, department_id);
create index projects_house_model_id_idx on public.projects (house_model_id);
create index projects_status_created_at_idx on public.projects (status, created_at desc);

create trigger projects_set_updated_at before update on public.projects
for each row execute function private.set_updated_at();

-- El estado avanza en orden: borrador → en revisión → activo → cerrado. En revisión puede volver
-- a borrador (el equipo le devuelve el proyecto al cliente para que lo ajuste, y el enlace vuelve
-- a poder cambiar materiales); cerrado es final.
create function private.check_project_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and not (
    (old.status = 'draft' and new.status in ('in_review', 'closed'))
    or (old.status = 'in_review' and new.status in ('draft', 'active', 'closed'))
    or (old.status = 'active' and new.status = 'closed')
  ) then
    raise exception 'Cambio de estado no permitido: % a %', old.status, new.status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function private.check_project_status_transition() from public;

create trigger projects_status_transition before update of status on public.projects
for each row execute function private.check_project_status_transition();

-- Bitácora del proyecto: cambios de estado y de montos. No copia la fila entera: ni el hash del
-- enlace privado, ni el nombre que escribió el cliente, ni el desglose.
create function private.audit_project_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, before_data, after_data)
  values (
    v_actor,
    (select ur.role from public.user_roles ur where ur.user_id = v_actor),
    'update',
    'projects',
    new.id::text,
    jsonb_build_object(
      'code', old.code,
      'status', old.status,
      'preliminary_usd_cents', old.preliminary_usd_cents,
      'construction_usd_cents', old.construction_usd_cents,
      'total_usd_cents', old.total_usd_cents
    ),
    jsonb_build_object(
      'code', new.code,
      'status', new.status,
      'preliminary_usd_cents', new.preliminary_usd_cents,
      'construction_usd_cents', new.construction_usd_cents,
      'total_usd_cents', new.total_usd_cents
    )
  );
  return new;
end;
$$;

revoke execute on function private.audit_project_change() from public;

create trigger projects_audit after update on public.projects
for each row when (
  (old.status, old.preliminary_usd_cents, old.construction_usd_cents)
  is distinct from (new.status, new.preliminary_usd_cents, new.construction_usd_cents)
)
execute function private.audit_project_change();

-- Una opción por categoría, con su precio del momento.
create table public.project_selections (
  project_id uuid not null references public.projects (id) on delete cascade,
  category text not null,
  option_id uuid not null,
  quantity numeric(9, 2) not null check (quantity >= 0),
  unit_price_usd_cents bigint not null check (unit_price_usd_cents >= 0),
  total_usd_cents bigint not null check (total_usd_cents >= 0),
  materials_usd_cents bigint not null check (materials_usd_cents between 0 and total_usd_cents),
  primary key (project_id, category),
  foreign key (option_id, category) references public.construction_options (id, category) on delete restrict
);

create index project_selections_option_category_idx on public.project_selections (option_id, category);

-- Solicitudes desde el panel del proyecto.
create table public.project_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind public.project_request_kind not null,
  message text check (char_length(message) <= 1000),
  status public.project_request_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_requests_project_id_idx on public.project_requests (project_id);
create index project_requests_status_created_at_idx on public.project_requests (status, created_at desc);

create trigger project_requests_set_updated_at before update on public.project_requests
for each row execute function private.set_updated_at();

-- Eventos del embudo del onboarding.
alter table public.funnel_events drop constraint funnel_events_event_check;
alter table public.funnel_events add constraint funnel_events_event_check check (event in (
  'quote_started', 'quote_step_viewed', 'quote_estimate_viewed', 'quote_saved', 'calculator_used',
  'project_started', 'project_step_viewed', 'project_estimate_viewed', 'project_saved'
));

-- =====================================================================================
-- Altas y cambios atómicos. Los llama solo el servidor (service_role), después de validar
-- con Zod y recalcular el costo con las reglas de la base.
-- =====================================================================================

-- Defensa adicional: nada inactivo, despublicado o de otra categoría.
create function private.check_project_refs(p_project jsonb, p_selections jsonb)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_department smallint := nullif(p_project ->> 'department_id', '')::smallint;
  v_model uuid := nullif(p_project ->> 'house_model_id', '')::uuid;
  v_lot uuid := nullif(p_project ->> 'lot_id', '')::uuid;
begin
  if jsonb_typeof(p_selections) is distinct from 'array' or jsonb_array_length(p_selections) = 0 then
    raise exception 'p_selections debe ser una lista con opciones' using errcode = 'invalid_parameter_value';
  end if;
  if v_department is not null
    and not exists (select 1 from public.departments d where d.id = v_department and d.is_active) then
    raise exception 'Departamento no disponible' using errcode = 'check_violation';
  end if;
  -- Un modelo del catálogo se construye con su área, sus plantas y sus baños.
  if v_model is not null and not exists (
    select 1 from public.house_models m
    where m.id = v_model
      and m.is_active
      and m.area_m2 = (p_project ->> 'area_m2')::numeric
      and least(m.floors, 2) = (p_project ->> 'floors')::smallint
      and greatest(1, ceil(m.bathrooms)) = (p_project ->> 'bathrooms')::smallint
  ) then
    raise exception 'Modelo no disponible' using errcode = 'check_violation';
  end if;
  -- El terreno, publicado y a su precio de hoy.
  if v_lot is not null and not exists (
    select 1 from public.lots l
    where l.id = v_lot
      and l.listing_status = 'published'
      and l.price_usd_cents = nullif(p_project ->> 'lot_price_usd_cents', '')::bigint
  ) then
    raise exception 'Terreno no disponible' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_selections) s
    where not exists (
      select 1 from public.construction_options o
      where o.id = (s ->> 'option_id')::uuid and o.category = s ->> 'category' and o.is_active
    )
  ) then
    raise exception 'Opción no disponible' using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function private.check_project_refs(jsonb, jsonb) from public;
grant execute on function private.check_project_refs(jsonb, jsonb) to service_role;

create function private.insert_project_selections(p_project_id uuid, p_selections jsonb)
returns void
language sql
set search_path = ''
as $$
  insert into public.project_selections (
    project_id, category, option_id, quantity, unit_price_usd_cents, total_usd_cents, materials_usd_cents
  )
  select
    p_project_id,
    s ->> 'category',
    (s ->> 'option_id')::uuid,
    (s ->> 'quantity')::numeric,
    (s ->> 'unit_price_usd_cents')::bigint,
    (s ->> 'total_usd_cents')::bigint,
    (s ->> 'materials_usd_cents')::bigint
  from jsonb_array_elements(p_selections) s;
$$;

revoke execute on function private.insert_project_selections(uuid, jsonb) from public;
grant execute on function private.insert_project_selections(uuid, jsonb) to service_role;

-- Defensa adicional para el dinero. El servidor calcula los montos y la base comprueba, antes de
-- guardar, que cuadren con el catálogo:
--   - cada opción, a su precio unitario de hoy y con la cantidad que pide el diseño del proyecto;
--   - total de la opción = cantidad × precio × factor del departamento, redondeado a dólares (de
--     ahí la tolerancia de un dólar), y su parte de materiales según la opción;
--   - el trámite previo y la obra suman lo de sus opciones, y el desglose que ve el cliente dice
--     lo mismo que las columnas que ve el equipo.
create function private.check_project_amounts(p_project_id uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_factor numeric;
  v_footprint numeric;
begin
  select * into strict v_project from public.projects p where p.id = p_project_id;
  v_factor := coalesce(
    (select f.factor from public.region_price_factors f where f.department_id = v_project.department_id),
    1
  );
  v_footprint := v_project.area_m2 / v_project.floors;

  if exists (
    select 1
    from public.project_selections s
    join public.construction_options o on o.id = s.option_id
    where s.project_id = p_project_id
      and (
        s.unit_price_usd_cents <> o.unit_price_usd_cents
        or abs(s.quantity - case o.pricing_basis
          when 'construction_m2' then v_project.area_m2
          when 'footprint_m2' then v_footprint
          when 'upper_floor_m2' then v_project.area_m2 - v_footprint
          when 'per_bathroom' then v_project.bathrooms
          else 1
        end) > 0.01
        or abs(s.total_usd_cents - s.quantity * s.unit_price_usd_cents * v_factor) > 100
        or abs(s.materials_usd_cents - s.total_usd_cents * o.materials_share_bp / 10000.0) > 100
      )
  ) then
    raise exception 'Los montos de una opción no cuadran con el catálogo' using errcode = 'check_violation';
  end if;

  if v_project.preliminary_usd_cents <> (
      select coalesce(sum(s.total_usd_cents), 0)
      from public.project_selections s
      join public.construction_options o on o.id = s.option_id
      where s.project_id = p_project_id and o.stage = 'preliminary'
    )
    or v_project.construction_usd_cents <> (
      select coalesce(sum(s.total_usd_cents), 0)
      from public.project_selections s
      join public.construction_options o on o.id = s.option_id
      where s.project_id = p_project_id and o.stage <> 'preliminary'
    ) then
    raise exception 'Los totales del proyecto no cuadran con sus opciones' using errcode = 'check_violation';
  end if;

  if (v_project.breakdown -> 'estimate' ->> 'totalUsdCents')::bigint is distinct from v_project.total_usd_cents
    or (v_project.breakdown -> 'estimate' ->> 'lotPriceUsdCents')::bigint
      is distinct from v_project.lot_price_usd_cents then
    raise exception 'El desglose no coincide con los totales' using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function private.check_project_amounts(uuid) from public;
grant execute on function private.check_project_amounts(uuid) to service_role;

-- Lead, proyecto y selecciones en una sola transacción.
create function public.submit_project(p_lead jsonb, p_project jsonb, p_selections jsonb)
returns table (project_id uuid, project_code text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead_id uuid;
  v_project_id uuid;
  v_code text;
begin
  perform private.check_project_refs(p_project, p_selections);

  v_lead_id := public.submit_lead(p_lead || jsonb_build_object('source', 'project'), null);

  insert into public.projects (
    lead_id, access_token_hash, access_expires_at, name, locale, land_status, lot_id,
    department_id, municipality_id, land_area_m2, design_source, house_model_id, area_m2,
    floors, bedrooms, bathrooms, preliminary_usd_cents, construction_usd_cents,
    total_usd_cents, lot_price_usd_cents, duration_weeks, breakdown, usd_to_hnl
  )
  values (
    v_lead_id,
    p_project ->> 'access_token_hash',
    now() + interval '365 days',
    p_project ->> 'name',
    p_project ->> 'locale',
    (p_project ->> 'land_status')::public.project_land_status,
    nullif(p_project ->> 'lot_id', '')::uuid,
    nullif(p_project ->> 'department_id', '')::smallint,
    nullif(p_project ->> 'municipality_id', '')::integer,
    nullif(p_project ->> 'land_area_m2', '')::numeric,
    (p_project ->> 'design_source')::public.project_design_source,
    nullif(p_project ->> 'house_model_id', '')::uuid,
    (p_project ->> 'area_m2')::numeric,
    (p_project ->> 'floors')::smallint,
    (p_project ->> 'bedrooms')::smallint,
    (p_project ->> 'bathrooms')::smallint,
    (p_project ->> 'preliminary_usd_cents')::bigint,
    (p_project ->> 'construction_usd_cents')::bigint,
    (p_project ->> 'total_usd_cents')::bigint,
    nullif(p_project ->> 'lot_price_usd_cents', '')::bigint,
    (p_project ->> 'duration_weeks')::smallint,
    p_project -> 'breakdown',
    (p_project ->> 'usd_to_hnl')::numeric
  )
  returning id, code into v_project_id, v_code;

  perform private.insert_project_selections(v_project_id, p_selections);
  perform private.check_project_amounts(v_project_id);

  return query select v_project_id, v_code;
end;
$$;

-- El cliente cambia sus materiales desde el panel. Solo mientras el proyecto es un
-- borrador: después, los cambios pasan por el equipo.
create function public.update_project_selections(p_token_hash text, p_project jsonb, p_selections jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  select p.id into v_project_id
  from public.projects p
  where p.access_token_hash = p_token_hash and p.access_expires_at > now() and p.status = 'draft'
  for update;

  if v_project_id is null then
    raise exception 'Proyecto no encontrado o no editable' using errcode = 'no_data_found';
  end if;

  perform private.check_project_refs(p_project, p_selections);

  update public.projects set
    preliminary_usd_cents = (p_project ->> 'preliminary_usd_cents')::bigint,
    construction_usd_cents = (p_project ->> 'construction_usd_cents')::bigint,
    total_usd_cents = (p_project ->> 'total_usd_cents')::bigint,
    duration_weeks = (p_project ->> 'duration_weeks')::smallint,
    breakdown = p_project -> 'breakdown',
    usd_to_hnl = (p_project ->> 'usd_to_hnl')::numeric
  where id = v_project_id;

  delete from public.project_selections where project_id = v_project_id;
  perform private.insert_project_selections(v_project_id, p_selections);
  perform private.check_project_amounts(v_project_id);

  return v_project_id;
end;
$$;

-- Una solicitud desde el panel. El token decide de qué proyecto es.
create function public.submit_project_request(p_token_hash text, p_kind text, p_message text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_request_id uuid;
begin
  select p.id into v_project_id
  from public.projects p
  where p.access_token_hash = p_token_hash and p.access_expires_at > now() and p.status <> 'closed';

  if v_project_id is null then
    raise exception 'Proyecto no encontrado' using errcode = 'no_data_found';
  end if;

  insert into public.project_requests (project_id, kind, message)
  values (v_project_id, p_kind::public.project_request_kind, nullif(p_message, ''))
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function public.submit_project(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.update_project_selections(text, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.submit_project_request(text, text, text) from public, anon, authenticated;
grant execute on function public.submit_project(jsonb, jsonb, jsonb) to service_role;
grant execute on function public.update_project_selections(text, jsonb, jsonb) to service_role;
grant execute on function public.submit_project_request(text, text, text) to service_role;

-- =====================================================================================
-- Permisos y RLS
-- =====================================================================================

-- construction_options: público lo activo; solo admin escribe ------------------------
alter table public.construction_options enable row level security;
revoke all on table public.construction_options from anon, authenticated, service_role;
grant select on table public.construction_options to anon, authenticated;
grant insert, update, delete on table public.construction_options to authenticated;
grant select, insert, update, delete on table public.construction_options to service_role;

create policy "construction_options_select_active_or_staff" on public.construction_options
for select to anon, authenticated
using (is_active or (select private.has_role('ventas', 'admin')));
create policy "construction_options_insert_admin" on public.construction_options for insert to authenticated
with check ((select private.is_admin()));
create policy "construction_options_update_admin" on public.construction_options for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "construction_options_delete_admin" on public.construction_options for delete to authenticated
using ((select private.is_admin()));

-- projects: el equipo lee y cambia el estado; el resto, solo el servidor -------------
alter table public.projects enable row level security;
revoke all on table public.projects from anon, authenticated, service_role;
-- El hash del token no se expone.
grant select (
  id, code, lead_id, access_expires_at, name, locale, status, land_status, lot_id, department_id,
  municipality_id, land_area_m2, design_source, house_model_id, area_m2, floors, bedrooms, bathrooms,
  preliminary_usd_cents, construction_usd_cents, total_usd_cents, lot_price_usd_cents,
  duration_weeks, breakdown, usd_to_hnl, created_at, updated_at
) on table public.projects to authenticated;
grant update (status) on table public.projects to authenticated;
grant select, insert, update, delete on table public.projects to service_role;

create policy "projects_select_sales_admin" on public.projects for select to authenticated
using ((select private.has_role('ventas', 'admin')));
create policy "projects_update_sales_admin" on public.projects for update to authenticated
using ((select private.has_role('ventas', 'admin')))
with check ((select private.has_role('ventas', 'admin')));

-- project_selections ------------------------------------------------------------------
alter table public.project_selections enable row level security;
revoke all on table public.project_selections from anon, authenticated, service_role;
grant select on table public.project_selections to authenticated;
grant select, insert, delete on table public.project_selections to service_role;

create policy "project_selections_select_sales_admin" on public.project_selections for select to authenticated
using ((select private.has_role('ventas', 'admin')));

-- project_requests --------------------------------------------------------------------
alter table public.project_requests enable row level security;
revoke all on table public.project_requests from anon, authenticated, service_role;
grant select on table public.project_requests to authenticated;
grant update (status) on table public.project_requests to authenticated;
grant select, insert, update, delete on table public.project_requests to service_role;

create policy "project_requests_select_sales_admin" on public.project_requests for select to authenticated
using ((select private.has_role('ventas', 'admin')));
create policy "project_requests_update_sales_admin" on public.project_requests for update to authenticated
using ((select private.has_role('ventas', 'admin')))
with check ((select private.has_role('ventas', 'admin')));
