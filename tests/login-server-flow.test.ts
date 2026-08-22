import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('login autentica diretamente no Supabase usando somente a chave pública', () => {
  const page = source('app/login/page.tsx');
  assert.match(page, /createClient\(\)/);
  assert.match(page, /signInWithPassword\(\{/);
  assert.match(page, /window\.location\.replace\(redirectTo\)/);
  assert.doesNotMatch(page, /\/api\/auth\/login/);
  assert.doesNotMatch(page, /useAuth/);
});

test('login trata indisponibilidade sem abandonar a página', () => {
  const page = source('app/login/page.tsx');
  assert.match(page, /withTimeout\(/);
  assert.match(page, /loginErrorMessage\(code\)/);
  assert.match(page, /finally \{[\s\S]*setLoading\(false\)/);
});

test('cliente Supabase falha de forma explícita quando a configuração pública está ausente', () => {
  const client = source('lib/supabase/client.ts');
  assert.match(client, /NEXT_PUBLIC_SUPABASE_URL\?\.trim\(\)/);
  assert.match(client, /NEXT_PUBLIC_SUPABASE_ANON_KEY\?\.trim\(\)/);
  assert.match(client, /supabase_public_configuration_missing/);
  assert.doesNotMatch(client, /SUPABASE_(?:SECRET|SERVICE_ROLE)/);
});
