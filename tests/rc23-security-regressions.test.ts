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
