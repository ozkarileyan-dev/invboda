-- ============================================================================
-- SQL PARA SUPABASE: ADMINISTRACIÓN DE FAMILIAS E INVITACIONES
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================================

-- 1. Extensión criptográfica requerida
create extension if not exists pgcrypto with schema extensions;

-- 2. Tipo enumerado para estados de confirmación (si no existe)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'rsvp_status') then
    create type public.rsvp_status as enum ('pending', 'accepted', 'declined');
  end if;
end
$$;

-- 3. Tabla principal de familias
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  display_name text not null,
  invited_guest_count smallint not null check (invited_guest_count between 1 and 20),
  guest_names text,
  active boolean not null default true,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migración para tablas existentes:
alter table public.families add column if not exists guest_names text;

comment on table public.families is 'Registro de cada familia o grupo invitado a la boda.';
comment on column public.families.invited_guest_count is 'Número total de personas/pases contemplados para la familia.';
comment on column public.families.guest_names is 'Nombres de los integrantes o invitados contemplados en el pase familiar.';

-- 4. Tabla de integrantes individuales (opcional)
create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  full_name text not null,
  is_invited boolean not null default true,
  created_at timestamptz not null default now(),
  unique (family_id, full_name)
);

-- 5. Tabla de tokens de invitación (secreto hash SHA-256)
create table if not exists public.invitation_tokens (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  token_hash char(64) not null unique,
  token_prefix varchar(16) not null,
  invited_guest_count smallint not null check (invited_guest_count between 1 and 20),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_visited_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitation_tokens_dates_check check (
    expires_at is null or expires_at > issued_at
  )
);

create index if not exists invitation_tokens_family_id_idx on public.invitation_tokens (family_id);
create index if not exists invitation_tokens_active_idx on public.invitation_tokens (family_id) where revoked_at is null;

-- 6. Respuestas RSVP actuales por enlace
create table if not exists public.rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null unique references public.invitation_tokens(id) on delete cascade,
  status public.rsvp_status not null default 'pending',
  confirmed_guest_count smallint not null default 0 check (confirmed_guest_count between 0 and 20),
  optional_message text check (char_length(optional_message) <= 500),
  first_responded_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. Historial / Auditoría de cambios en RSVP
create table if not exists public.rsvp_response_audit (
  id bigint generated always as identity primary key,
  response_id uuid not null references public.rsvp_responses(id) on delete cascade,
  token_id uuid not null references public.invitation_tokens(id) on delete cascade,
  previous_status public.rsvp_status,
  new_status public.rsvp_status not null,
  previous_guest_count smallint,
  new_guest_count smallint not null,
  previous_message text,
  new_message text,
  changed_at timestamptz not null default now()
);

create index if not exists rsvp_response_audit_token_id_idx on public.rsvp_response_audit (token_id, changed_at desc);

-- 8. Bitácora de visitas a enlaces
create table if not exists public.invitation_visit_logs (
  id bigint generated always as identity primary key,
  token_id uuid not null references public.invitation_tokens(id) on delete cascade,
  visited_at timestamptz not null default now(),
  ip_hash char(64),
  user_agent text,
  referrer text,
  request_path text not null default '/'
);

create index if not exists invitation_visit_logs_token_id_idx on public.invitation_visit_logs (token_id, visited_at desc);

-- 9. Trigger para actualizar el campo updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists families_set_updated_at on public.families;
create trigger families_set_updated_at
before update on public.families
for each row execute procedure public.set_updated_at();

drop trigger if exists rsvp_responses_set_updated_at on public.rsvp_responses;
create trigger rsvp_responses_set_updated_at
before update on public.rsvp_responses
for each row execute procedure public.set_updated_at();

-- 10. Trigger para validar y asignar cupos de RSVP automáticamente
create or replace function public.validate_rsvp_response()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  token_guest_count smallint;
begin
  select invited_guest_count
  into token_guest_count
  from public.invitation_tokens
  where id = new.token_id;

  if not found then
    raise exception 'El token de invitación no existe.';
  end if;

  if new.status = 'accepted' then
    if new.confirmed_guest_count is null or new.confirmed_guest_count <= 0 then
      new.confirmed_guest_count = token_guest_count;
    end if;
  elsif new.status in ('pending', 'declined') then
    new.confirmed_guest_count = 0;
  end if;

  if new.status <> 'pending' and new.first_responded_at is null then
    new.first_responded_at = now();
  end if;

  if new.status <> 'pending' then
    new.responded_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists rsvp_responses_validate on public.rsvp_responses;
create trigger rsvp_responses_validate
before insert or update on public.rsvp_responses
for each row execute procedure public.validate_rsvp_response();

-- 11. Trigger para registrar auditoría de cambios
create or replace function public.audit_rsvp_response()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.rsvp_response_audit (
    response_id,
    token_id,
    previous_status,
    new_status,
    previous_guest_count,
    new_guest_count,
    previous_message,
    new_message
  ) values (
    new.id,
    new.token_id,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    case when tg_op = 'INSERT' then null else old.confirmed_guest_count end,
    new.confirmed_guest_count,
    case when tg_op = 'INSERT' then null else old.optional_message end,
    new.optional_message
  );
  return new;
end;
$$;

drop trigger if exists rsvp_responses_audit on public.rsvp_responses;
create trigger rsvp_responses_audit
after insert or update on public.rsvp_responses
for each row execute procedure public.audit_rsvp_response();

-- 12. Función RPC para emitir tokens seguros (re-emisión revoca el anterior)
create or replace function public.issue_invitation_token(
  p_family_id uuid,
  p_expires_at timestamptz default '2026-11-22 06:00:00+00'
)
returns table (
  token_id uuid,
  raw_token text,
  invitation_url_path text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
  v_token_hash char(64);
  v_guest_count smallint;
  v_token_id uuid;
begin
  select invited_guest_count
  into v_guest_count
  from public.families
  where id = p_family_id and active = true;

  if not found then
    raise exception 'La familia no existe o está inactiva.';
  end if;

  -- Revocar tokens previos activos de esta familia
  update public.invitation_tokens
  set revoked_at = now()
  where family_id = p_family_id and revoked_at is null;

  -- Formato seguro: inv1_ + 64 caracteres hexadecimales aleatorios (256 bits criptográficos)
  v_token := 'inv1_' || encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.invitation_tokens (
    family_id,
    token_hash,
    token_prefix,
    invited_guest_count,
    expires_at
  ) values (
    p_family_id,
    v_token_hash,
    left(v_token, 16),
    v_guest_count,
    p_expires_at
  ) returning id into v_token_id;

  return query select
    v_token_id,
    v_token,
    '/?token=' || v_token,
    p_expires_at;
end;
$$;

-- 13. Vista administrativa consolidada con estado de familias y RSVP
drop view if exists public.family_invitation_summary cascade;

create view public.family_invitation_summary
with (security_invoker = true)
as
select
  f.id as family_id,
  f.reference_code,
  f.display_name,
  f.invited_guest_count,
  f.guest_names,
  f.active,
  f.internal_notes,
  f.created_at as family_created_at,
  f.updated_at as family_updated_at,
  t.id as token_id,
  t.token_prefix,
  t.issued_at,
  t.expires_at,
  t.revoked_at,
  t.last_visited_at,
  coalesce(r.status, 'pending'::public.rsvp_status) as rsvp_status,
  coalesce(r.confirmed_guest_count, 0) as confirmed_guest_count,
  r.optional_message,
  r.responded_at,
  r.first_responded_at
from public.families f
left join lateral (
  select * from public.invitation_tokens t
  where t.family_id = f.id
  order by case when t.revoked_at is null then 0 else 1 end, t.issued_at desc
  limit 1
) t on true
left join public.rsvp_responses r on r.token_id = t.id;

-- 14. Seguridad RLS y Permisos
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.invitation_tokens enable row level security;
alter table public.rsvp_responses enable row level security;
alter table public.rsvp_response_audit enable row level security;
alter table public.invitation_visit_logs enable row level security;

-- Revocar acceso público directo por seguridad (solo API backend con service_role)
revoke all on public.families, public.family_members, public.invitation_tokens,
  public.rsvp_responses, public.rsvp_response_audit, public.invitation_visit_logs,
  public.family_invitation_summary
  from anon, authenticated;

grant select, insert, update, delete on public.families, public.family_members,
  public.invitation_tokens, public.rsvp_responses, public.rsvp_response_audit,
  public.invitation_visit_logs to service_role;

grant select on public.family_invitation_summary to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke all on function public.issue_invitation_token(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.issue_invitation_token(uuid, timestamptz) to service_role;
