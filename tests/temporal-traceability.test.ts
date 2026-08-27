import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('memória temporal preserva entradas e resultado sob hash', () => {
  const page = source('app/medicoes-transformadores/page.tsx');
  assert.match(page, /createAuditContentHash\(\{[\s\S]*?inputs: inputsSnapshot,[\s\S]*?result: recommendation/);
  assert.match(page, /measurements: measurements\.map/);
  assert.match(page, /Salvar memória técnica/);
});

test('memória registra origem, liberação e confirmações técnicas', () => {
  const page = source('app/medicoes-transformadores/page.tsx');
  assert.match(page, /source_method: "temporal_measurements"/);
  assert.match(page, /release_level: releaseLevel/);
  assert.match(page, /engineering_confirmations: engineeringConfirmations/);
});

test('migração impede vínculo de transformador entre empresas', () => {
  const migration = source('supabase/migrations/202608210002_temporal_dimensioning_traceability.sql');
  assert.match(migration, /public\.can_access_tenant\(tenant_id\)/);
  assert.match(migration, /t\.id = transformer_id[\s\S]*?t\.tenant_id = dimensioning_runs\.tenant_id/);
  assert.match(migration, /conditional_specification/);
});
