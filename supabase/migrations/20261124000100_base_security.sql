-- =====================================================================================
-- Base de seguridad: roles, funciones de permisos, perfiles, auditoría y rate limiting.
--
-- Reglas que siguen todas las migraciones del proyecto:
--   1. Toda tabla de `public` lleva RLS activado. Un test de CI falla si falta.
--   2. Los permisos (GRANT) se dan de forma explícita, tabla por tabla. No dependemos
--      de los permisos por defecto de Supabase.
--   3. Las funciones SECURITY DEFINER fijan `search_path = ''` y nombran todo con esquema.
--   4. Las funciones de permisos viven en el esquema `private`, que la API no expone.
-- =====================================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- -------------------------------------------------------------------------------------
-- Roles de la plataforma
-- -------------------------------------------------------------------------------------
create type public.user_role as enum (
  'cliente',              -- migrante que compra o construye
  'familiar_autorizado',  -- familiar en Honduras, solo lectura del proyecto al que lo invitaron
  'ventas',
  'gerente_proyecto',
  'logistica',
  'admin'
);

-- -------------------------------------------------------------------------------------
-- Utilidades
-- -------------------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -------------------------------------------------------------------------------------
-- Perfiles: datos mínimos de la persona. Se crean solos al registrarse.
-- -------------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) between 1 and 120),
  phone text check (phone ~ '^\+?[0-9]{8,15}$'),
  country text not null default 'US' check (country ~ '^[A-Z]{2}$'),
  us_state text check (us_state ~ '^[A-Z]{2}$'),
  preferred_locale text not null default 'es' check (preferred_locale in ('es', 'en')),
  notification_prefs jsonb not null default '{"email": true}'::jsonb
    check (jsonb_typeof(notification_prefs) = 'object' and pg_column_size(notification_prefs) <= 1024),
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Datos mínimos de cada persona con cuenta. Nunca guarda datos de tarjeta.';

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

-- -------------------------------------------------------------------------------------
-- Rol global de cada persona. Va en tabla aparte para que nadie pueda subirse de rol
-- editando su propio perfil.
-- -------------------------------------------------------------------------------------
create table public.user_roles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role public.user_role not null default 'cliente',
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now()
);

comment on table public.user_roles is 'Rol global. El acceso a un proyecto concreto se decide en project_members (Fase 2).';

-- -------------------------------------------------------------------------------------
-- Funciones de permisos. Las usan las políticas de RLS de todo el proyecto.
-- SECURITY DEFINER: leen user_roles sin que la política de user_roles se llame a sí misma.
-- -------------------------------------------------------------------------------------
create function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select ur.role from public.user_roles ur where ur.user_id = (select auth.uid());
$$;

create function private.has_role(variadic allowed public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select ur.role from public.user_roles ur where ur.user_id = (select auth.uid())) = any (allowed),
    false
  );
$$;

create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('ventas', 'gerente_proyecto', 'logistica', 'admin');
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('admin');
$$;

revoke execute on function private.current_user_role() from public;
revoke execute on function private.has_role(public.user_role[]) from public;
revoke execute on function private.is_staff() from public;
revoke execute on function private.is_admin() from public;
grant execute on function private.current_user_role() to anon, authenticated, service_role;
grant execute on function private.has_role(public.user_role[]) to anon, authenticated, service_role;
grant execute on function private.is_staff() to anon, authenticated, service_role;
grant execute on function private.is_admin() to anon, authenticated, service_role;

-- -------------------------------------------------------------------------------------
-- Alta automática: al crearse un usuario en auth.users nace su perfil con rol `cliente`.
-- El rol NUNCA se toma de los metadatos del usuario: esos los controla quien se registra.
-- -------------------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, preferred_locale)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), ''),
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'es' end
  );

  insert into public.user_roles (user_id, role) values (new.id, 'cliente');

  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- -------------------------------------------------------------------------------------
-- Bitácora de auditoría. Solo se puede insertar: nadie edita ni borra, ni el servidor.
-- `actor_id` no es llave foránea a propósito: si se borra una cuenta, su rastro queda.
-- -------------------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_role public.user_role,
  action text not null check (char_length(action) between 1 and 80),
  entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text,
  user_agent text check (char_length(user_agent) <= 400)
);

comment on table public.audit_log is 'Acciones sensibles: cambios de precio, pagos, estado de obra, documentos, roles. Solo inserción.';

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_actor_idx on public.audit_log (actor_id);
create index audit_log_occurred_at_idx on public.audit_log (occurred_at desc);

create function private.prevent_audit_log_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log es de solo inserción' using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_log_no_update_delete
before update or delete on public.audit_log
for each row execute function private.prevent_audit_log_changes();

create trigger audit_log_no_truncate
before truncate on public.audit_log
for each statement execute function private.prevent_audit_log_changes();

-- Trigger genérico para tablas sensibles. Registra quién cambió qué, con el antes y el
-- después. Uso: `... for each row execute function private.audit_row_change('id')`,
-- donde el argumento es la columna que identifica la fila.
create function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_id_column text := coalesce(tg_argv[0], 'id');
  v_before jsonb;
  v_after jsonb;
begin
  if tg_op = 'INSERT' then
    v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    if v_before = v_after then
      return new;
    end if;
  else
    v_before := to_jsonb(old);
  end if;

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, before_data, after_data)
  values (
    v_actor,
    (select ur.role from public.user_roles ur where ur.user_id = v_actor),
    lower(tg_op),
    tg_table_name,
    coalesce(v_after ->> v_id_column, v_before ->> v_id_column),
    v_before,
    v_after
  );

  return coalesce(new, old);
end;
$$;

revoke execute on function private.audit_row_change() from public;

-- Cada cambio de rol queda firmado con quién lo hizo y cuándo, y va a la bitácora.
create function private.stamp_role_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'user_id no se puede cambiar' using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'INSERT' or new.role is distinct from old.role then
    new.assigned_by := coalesce((select auth.uid()), new.assigned_by);
    new.assigned_at := now();
  end if;
  return new;
end;
$$;

create trigger user_roles_stamp
before insert or update on public.user_roles
for each row execute function private.stamp_role_assignment();

create trigger user_roles_audit
after insert or update or delete on public.user_roles
for each row execute function private.audit_row_change('user_id');

-- -------------------------------------------------------------------------------------
-- Rate limiting: contadores por ventana fija. Solo el servidor (service role) puede usarlo.
-- -------------------------------------------------------------------------------------
create table public.rate_limits (
  bucket text not null check (char_length(bucket) between 1 and 200),
  window_start timestamptz not null,
  hits integer not null default 1 check (hits > 0),
  primary key (bucket, window_start)
);

comment on table public.rate_limits is 'Contadores de intentos. El bucket es acción + huella anonimizada; nunca una IP en claro.';

create function public.check_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_hits integer;
begin
  if p_bucket is null or char_length(p_bucket) not between 1 and 200
     or p_limit is null or p_limit < 1
     or p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    raise exception 'Parámetros de rate limit inválidos' using errcode = 'invalid_parameter_value';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits as rl (bucket, window_start)
  values (p_bucket, v_window_start)
  on conflict (bucket, window_start) do update set hits = rl.hits + 1
  returning rl.hits into v_hits;

  -- Limpieza ocasional de ventanas viejas, para que la tabla no crezca sin límite.
  if random() < 0.02 then
    delete from public.rate_limits rl where rl.window_start < now() - interval '2 days';
  end if;

  return query
  select
    v_hits <= p_limit,
    greatest(p_limit - v_hits, 0),
    v_window_start + make_interval(secs => p_window_seconds);
end;
$$;

revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- =====================================================================================
-- Permisos y RLS
-- =====================================================================================

-- profiles ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
-- Solo estas columnas son editables por la persona. `stripe_customer_id` lo escribe el servidor.
grant update (full_name, phone, country, us_state, preferred_locale, notification_prefs)
  on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

create policy "profiles_select_own_or_sales_admin"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.has_role('ventas', 'admin')));

create policy "profiles_update_own"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- user_roles -------------------------------------------------------------------------
alter table public.user_roles enable row level security;
revoke all on table public.user_roles from anon, authenticated;
grant select on table public.user_roles to authenticated;
grant update (role) on table public.user_roles to authenticated;
grant all on table public.user_roles to service_role;

create policy "user_roles_select_own_or_admin"
on public.user_roles for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));

-- Solo un admin cambia roles, y no el suyo propio (evita que un admin se quede solo sin querer
-- o que una sesión robada se blinde). El cambio queda en audit_log con su nombre.
create policy "user_roles_update_admin_not_self"
on public.user_roles for update to authenticated
using ((select private.is_admin()) and user_id <> (select auth.uid()))
with check ((select private.is_admin()) and user_id <> (select auth.uid()));

-- audit_log --------------------------------------------------------------------------
alter table public.audit_log enable row level security;
revoke all on table public.audit_log from anon, authenticated, service_role;
grant select on table public.audit_log to authenticated;
grant select, insert on table public.audit_log to service_role;

create policy "audit_log_select_admin"
on public.audit_log for select to authenticated
using ((select private.is_admin()));

-- rate_limits ------------------------------------------------------------------------
-- RLS activado y sin políticas: por la API no entra nadie. Se usa solo vía check_rate_limit().
alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon, authenticated, service_role;
