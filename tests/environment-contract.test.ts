import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('contrato de ambiente não publica segredos administrativos', () => {
  const example = source('.env.example');
  assert.doesNotMatch(example, /NEXT_PUBLIC_(?:SUPABASE_SECRET|SUPABASE_SERVICE_ROLE|MP_ACCESS|DEEPSEEK|RESEND)/);
  assert.match(example, /^SUPABASE_SECRET_KEY=/m);
  assert.match(example, /^MP_WEBHOOK_SECRET=/m);
  assert.match(example, /^RATE_LIMIT_SALT=/m);
});

test('health exige autenticação, proteção contra abuso e pagamentos completos', () => {
  const health = source('app/api/health/route.ts');
  assert.match(health, /authentication:/);
  assert.match(health, /privilegedDatabase:/);
  assert.match(health, /abuseProtection:/);
  assert.match(health, /payments:/);
  assert.match(health, /process\.env\.VERCEL_ENV !== 'production'/);
});

test('documentação proíbe distribuir arquivos locais com segredos', () => {
  const checklist = source('docs/ENVIRONMENT_CHECKLIST.md');
  assert.match(checklist, /Nunca copie `.env\.local` para ZIP, GitHub ou mensagens/);
  assert.match(checklist, /alterações não modificam deploys já concluídos/);
});

test('laudo protegido usa a sessão do servidor em vez de cliente anônimo', () => {
  const laudo = source('app/laudo/[id]/page.tsx');
  assert.match(laudo, /from '@\/lib\/supabase\/server'/);
  assert.match(laudo, /await createClient\(\)/);
  assert.doesNotMatch(laudo, /process\.env\.NEXT_PUBLIC_SUPABASE/);
});

test('analisador PDF carrega o worker e mantém dependências externas no servidor', () => {
  const route = source('app/api/capacitormanager/auditar-fatura/route.ts');
  const nextConfig = source('next.config.ts');
  const demo = source('app/demo/page.tsx');

  assert.match(route, /import\s+["']pdf-parse\/worker["'];/);
  assert.match(nextConfig, /serverExternalPackages:\s*\[[^\]]*["']pdf-parse["']/s);
  assert.match(nextConfig, /serverExternalPackages:\s*\[[^\]]*["']@napi-rs\/canvas["']/s);
  assert.match(demo, /allowLocalFallback = response\.status >= 500/);
  assert.match(demo, /if \(!allowLocalFallback && !isTransportFailure\) throw serverError/);
});
