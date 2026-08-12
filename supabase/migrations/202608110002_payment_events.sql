-- Idempotência e rastreabilidade das notificações de pagamento.
begin;

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_key text not null unique,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create index if not exists idx_payment_webhook_events_received_at
  on public.payment_webhook_events (received_at desc);

-- Somente o servidor com service role acessa esta tabela.
alter table public.payment_webhook_events enable row level security;

commit;
