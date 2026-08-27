-- Reinstala a infraestrutura persistente do limitador de API caso a migração
-- de endurecimento não tenha sido aplicada no banco conectado à Vercel.

create table if not exists public.api_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  actor_hash text not null,
  endpoint text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_usage_endpoint_actor_time
  on public.api_usage_events (endpoint, actor_hash, created_at desc);

alter table public.api_usage_events enable row level security;

create or replace function public.consume_api_rate_limit(
  p_endpoint text,
  p_actor_hash text,
  p_user_id uuid,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count bigint;
begin
  if p_endpoint is null or p_actor_hash is null
     or p_max_requests < 1 or p_window_seconds < 1 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_endpoint || ':' || p_actor_hash, 0));

  select count(*) into recent_count
  from public.api_usage_events
  where endpoint = p_endpoint
    and actor_hash = p_actor_hash
    and created_at >= now() - make_interval(secs => p_window_seconds);

  if recent_count >= p_max_requests then
    return false;
  end if;

  insert into public.api_usage_events (endpoint, actor_hash, user_id)
  values (p_endpoint, p_actor_hash, p_user_id);

  return true;
end;
$$;

revoke all on table public.api_usage_events from anon, authenticated;
revoke all on function public.consume_api_rate_limit(text,text,uuid,integer,integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text,text,uuid,integer,integer)
  to service_role;

-- Atualiza imediatamente o cache de funções usado pela API REST do Supabase.
notify pgrst, 'reload schema';

select
  case
    when to_regclass('public.api_usage_events') is not null
     and to_regprocedure('public.consume_api_rate_limit(text,text,uuid,integer,integer)') is not null
    then 'OK'
    else 'FALTA'
  end as limitador_api;
