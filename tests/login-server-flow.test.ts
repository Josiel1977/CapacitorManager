import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('login envia a credencial ao endpoint seguro do mesmo domínio', () => {
  const page = source('app/login/page.tsx');
  assert.match(page, /method="post"/);
  assert.match(page, /action="\/api\/auth\/login"/);
  assert.doesNotMatch(page, /preventDefault\(\)|useAuth/);
});

test('endpoint autentica no servidor e grava os cookies na resposta', () => {
  const route = source('app/api/auth/login/route.ts');
  assert.match(route, /signInWithPassword\(\{ email, password \}\)/);
  assert.match(route, /response\.cookies\.set/);
  assert.match(route, /safeRedirect/);
});

test('endpoint não devolve a senha na URL de erro', () => {
  const route = source('app/api/auth/login/route.ts');
  assert.doesNotMatch(route, /searchParams\.set\(['"](?:password|email)/);
  assert.match(route, /searchParams\.set\('error', code\)/);
});
