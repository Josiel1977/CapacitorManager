import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('sessão JWT inválida volta ao login e não é tratada como indisponibilidade', () => {
  const proxy = source('proxy.ts');
  assert.match(proxy, /!result\.error && typeof result\.data\?\.claims\?\.sub/);
  assert.doesNotMatch(proxy, /if \(result\.error\) authAvailable = false/);
  assert.match(proxy, /profile\.role !== 'platform_admin'/);
});

test('autorização separa leitura, escrita e suporte temporário', () => {
  const migration = source('supabase/migrations/202608230001_strict_tenant_access.sql');
  assert.match(migration, /can_read_tenant/);
  assert.match(migration, /can_write_tenant/);
  assert.match(migration, /support_access_grants/);
  assert.match(migration, /read_only boolean not null default true check \(read_only = true\)/);
  assert.match(migration, /payment_status in \('trial', 'active', 'grace', 'internal'\)/);
  assert.doesNotMatch(migration, /is_platform_admin\(\)\s*or\s*target_tenant_id/);
});

test('tenant interno JM permanece isolado e dispensado da cobrança', () => {
  const migration = source('supabase/migrations/202608230001_strict_tenant_access.sql');
  assert.match(migration, /11111111-1111-1111-1111-111111111111/);
  assert.match(migration, /billing_exempt = true/);
  assert.match(migration, /payment_status = 'internal'/);
  assert.match(migration, /set id = '11111111-1111-1111-1111-111111111111'/);
  assert.match(migration, /alter column tenant_id set not null/);
});

test('profiles e tabelas operacionais não mantêm políticas públicas legadas', () => {
  const migration = source('supabase/migrations/202608230001_strict_tenant_access.sql');
  assert.match(migration, /alter table public\.profiles enable row level security/);
  assert.match(migration, /revoke all privileges on table public\.profiles from anon/);
  assert.match(migration, /profiles_own_select[\s\S]*?to authenticated/);
  assert.match(migration, /for select to authenticated using \(public\.can_read_tenant\(tenant_id\)\)/);
  assert.doesNotMatch(migration, /using \(true\)|with check \(true\)/i);
});

test('migração estrita completa o esquema temporal antes da política auditável', () => {
  const migration = source('supabase/migrations/202608230001_strict_tenant_access.sql');
  const addTransformer = migration.indexOf('add column if not exists transformer_id');
  const insertPolicy = migration.indexOf('create policy tenant_insert on public.dimensioning_runs');
  assert.ok(addTransformer >= 0);
  assert.ok(insertPolicy > addTransformer);
  assert.match(migration, /add column if not exists source_method/);
  assert.match(migration, /add column if not exists release_level/);
  assert.match(migration, /add column if not exists engineering_confirmations/);
});

test('medições carregam tolerâncias pela empresa autenticada', () => {
  const measurements = source('app/medicoes/page.tsx');
  assert.match(measurements, /\.eq\('tenant_id', userTenantId\)/);
  assert.doesNotMatch(measurements, /\.eq\('id', 'global'\)/);
});

test('administrador de tenant não contorna cobrança ou recursos pagos', () => {
  const subscription = source('app/api/subscription/status/route.ts');
  const chat = source('app/api/chat/route.ts');
  const guard = source('lib/useSubscriptionGuard.ts');
  assert.doesNotMatch(subscription, /profile\.role === 'admin'/);
  assert.match(subscription, /tenant\.billing_exempt/);
  assert.match(chat, /profile\?\.role !== 'platform_admin'/);
  assert.match(guard, /profile\.role === 'platform_admin'/);
});

test('webhook recupera processamento abandonado e sincroniza cancelamento', () => {
  const webhook = source('lib/mercadopago/webhook.ts');
  assert.match(webhook, /10 \* 60 \* 1000/);
  assert.match(webhook, /isStaleProcessing/);
  assert.match(webhook, /subscription_status: paymentStatus/);
});

test('campos do lead escapam caracteres HTML individualmente', () => {
  const leads = source('lib/server/leads.ts');
  assert.match(leads, /replace\(\/\[&<>"\]\/g/);
  assert.doesNotMatch(leads, /\[&<>"\]\+\/g/);
});
