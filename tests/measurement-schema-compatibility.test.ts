import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('manutenção não consulta a coluna legada data_medicao', () => {
  const maintenance = source('app/manutencao/page.tsx');
  assert.doesNotMatch(maintenance, /data_medicao/);
  assert.match(maintenance, /from\("medicoes"\)\.select\("\*"\)/);
});

test('gráficos aceitam medições com ou sem frequência armazenada', () => {
  const charts = source('app/graficos/page.tsx');
  assert.match(charts, /from\('medicoes'\)[\s\S]*?\.select\('\*'\)/);
});

test('configurações usa os nomes atuais do histórico de medições', () => {
  const settings = source('app/configuracoes/page.tsx');
  assert.doesNotMatch(settings, /data_medicao|tipo_medicao/);
  assert.match(settings, /created_at/);
  assert.match(settings, /desvio_percentual/);
});
