import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSupabaseOrigin } from '../next.config.ts';

test('remove quebra de linha da origem Supabase usada na CSP', () => {
  assert.equal(
    normalizeSupabaseOrigin('https://projeto.supabase.co\n'),
    'https://projeto.supabase.co',
  );
});

test('reduz a configuração Supabase à origem HTTPS', () => {
  assert.equal(
    normalizeSupabaseOrigin('  https://projeto.supabase.co/auth/v1  '),
    'https://projeto.supabase.co',
  );
});

test('não insere origem insegura ou inválida na CSP', () => {
  assert.equal(normalizeSupabaseOrigin('http://projeto.supabase.co'), 'https://*.supabase.co');
  assert.equal(normalizeSupabaseOrigin('valor-inválido'), 'https://*.supabase.co');
  assert.equal(normalizeSupabaseOrigin(undefined), 'https://*.supabase.co');
});
