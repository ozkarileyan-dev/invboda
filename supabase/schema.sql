-- Esquema Supabase para invitaciones personalizadas y RSVP.
-- Ejecutar una sola vez desde Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto with schema extensions;

create type public.rsvp_status as enum ('pending', 'accepted', 'declined');

-- Registro previo: una fila por familia o grupo invitado.
create table public.families (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  display_name text not null,
  invited_guest_count smallint not null check (invited_guest_count between 1 and 20),
  active boolean not null default true,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.families is 'Registro previo de cada familia o grupo invitado.';
comment on column public.families.invited_guest_count is 'Número total de personas contempladas para la familia.';

-- Opcional: permite guardar los nombres de los integrantes ya contemplados.
create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  full_name text not null,
  is_invited boolean not null default true,
  created_at timestamptz not null default now(),
  unique (family_id, full_name)
);

-- Un token se emite para una familia. El secreto sin hash solo se entrega al crearlo.
create table public.invitation_tokens (
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

comment on table public.invitation_tokens is 'Tokens opacos por familia. Nunca guardar el token original, solo SHA-256.';
comment on column public.invitation_tokens.invited_guest_count is 'Copia del cupo al emitir el enlace; conserva el historial si el cupo cambia después.';

create index invitation_tokens_family_id_idx on public.invitation_tokens (family_id);
create index invitation_tokens_active_idx on public.invitation_tokens (family_id) where revoked_at is null;

-- Respuesta vigente. El cupo confirmado queda en cero al rechazar y conserva el cupo del token al aceptar.
create table public.rsvp_responses (
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

comment on table public.rsvp_responses is 'Respuesta actual por enlace de invitación.';

-- Historial de cambios de RSVP para auditoría.
create table public.rsvp_response_audit (
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

create index rsvp_response_audit_token_id_idx on public.rsvp_response_audit (token_id, changed_at desc);

-- Bitácora: una fila por carga válida del enlace. No guarda IP sin procesar.
create table public.invitation_visit_logs (
  id bigint generated always as identity primary key,
  token_id uuid not null references public.invitation_tokens(id) on delete cascade,
  visited_at timestamptz not null default now(),
  ip_hash char(64),
  user_agent text,
  referrer text,
  request_path text not null default '/',
  unique (id)
);

create index invitation_visit_logs_token_id_idx on public.invitation_visit_logs (token_id, visited_at desc);

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

create trigger families_set_updated_at
before update on public.families
for each row execute procedure public.set_updated_at();

create trigger rsvp_responses_set_updated_at
before update on public.rsvp_responses
for each row execute procedure public.set_updated_at();

-- Asegura que una aceptación use exactamente el cupo asociado con el token.
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
    new.confirmed_guest_count = token_guest_count;
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

create trigger rsvp_responses_validate
before insert or update on public.rsvp_responses
for each row execute procedure public.validate_rsvp_response();

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

create trigger rsvp_responses_audit
after insert or update on public.rsvp_responses
for each row execute procedure public.audit_rsvp_response();

-- Emite un enlace por familia y revoca los enlaces anteriores de esa familia.
-- El resultado raw_token se muestra una sola vez: envíalo por WhatsApp/correo y no lo almacenes.
create or replace function public.issue_invitation_token(
  p_family_id uuid,
  p_expires_at timestamptz default '2026-11-22 06:00:00+00'
)
returns table (token_id uuid, raw_token text, invitation_url_path text, expires_at timestamptz)
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

  update public.invitation_tokens
  set revoked_at = now()
  where family_id = p_family_id and revoked_at is null;

  -- Estructura: inv1_ + 64 caracteres hexadecimales aleatorios (256 bits).
  v_token := 'inv1_' || encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.invitation_tokens (
    family_id, token_hash, token_prefix, invited_guest_count, expires_at
  ) values (
    p_family_id, v_token_hash, left(v_token, 16), v_guest_count, p_expires_at
  ) returning id into v_token_id;

  return query select
    v_token_id,
    v_token,
    '/?token=' || v_token,
    p_expires_at;
end;
$$;

-- Cierra el acceso directo público. Vercel usará SUPABASE_SERVICE_ROLE_KEY solo en sus funciones API.
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.invitation_tokens enable row level security;
alter table public.rsvp_responses enable row level security;
alter table public.rsvp_response_audit enable row level security;
alter table public.invitation_visit_logs enable row level security;

revoke all on public.families, public.family_members, public.invitation_tokens,
  public.rsvp_responses, public.rsvp_response_audit, public.invitation_visit_logs
  from anon, authenticated;

grant select, insert, update, delete on public.families, public.family_members,
  public.invitation_tokens, public.rsvp_responses, public.rsvp_response_audit,
  public.invitation_visit_logs to service_role;

grant usage, select on all sequences in schema public to service_role;
revoke all on function public.issue_invitation_token(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.issue_invitation_token(uuid, timestamptz) to service_role;

-- Resumen administrativo; no exponer al cliente.
create view public.family_invitation_summary
with (security_invoker = true)
as
select
  f.id as family_id,
  f.reference_code,
  f.display_name,
  f.invited_guest_count,
  t.id as token_id,
  t.issued_at,
  t.expires_at,
  t.revoked_at,
  t.last_visited_at,
  r.status as rsvp_status,
  r.confirmed_guest_count,
  r.optional_message,
  r.responded_at
from public.families f
left join lateral (
  select * from public.invitation_tokens t
  where t.family_id = f.id
  order by t.issued_at desc
  limit 1
) t on true
left join public.rsvp_responses r on r.token_id = t.id;

revoke all on public.family_invitation_summary from anon, authenticated;
grant select on public.family_invitation_summary to service_role;
