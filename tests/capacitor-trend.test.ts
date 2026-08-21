import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCapacitorTrend, calculateDeviationProjection } from '../lib/domain/capacitorAnalysis.ts';

test('considera a ordem cronológica mesmo quando as medições chegam invertidas', () => {
  const trend = calculateCapacitorTrend([
    { created_at: '2026-02-01T00:00:00Z', desvio_percentual: -9 },
    { created_at: '2026-01-01T00:00:00Z', desvio_percentual: -5 },
  ]);

  assert.equal(trend?.tendencia, 'piorando');
  assert.equal(trend?.variacao, 4);
  assert.equal(trend?.primeiroDesvio, -5);
  assert.equal(trend?.ultimoDesvio, -9);
});

test('classifica como melhora quando o desvio absoluto se aproxima do nominal', () => {
  const trend = calculateCapacitorTrend([
    { created_at: '2026-01-01T00:00:00Z', desvio_percentual: 10 },
    { created_at: '2026-02-01T00:00:00Z', desvio_percentual: 5 },
  ]);

  assert.equal(trend?.tendencia, 'melhorando');
  assert.equal(trend?.variacao, -5);
});

test('não projeta regressão quando todas as medições têm a mesma data', () => {
  assert.equal(calculateDeviationProjection([
    { created_at: '2026-01-01T00:00:00Z', desvio_percentual: 5 },
    { created_at: '2026-01-01T00:00:00Z', desvio_percentual: 7 },
  ]), null);
});

test('projeta a evolução pelo afastamento absoluto do nominal', () => {
  const projection = calculateDeviationProjection([
    { created_at: '2026-01-01T00:00:00Z', desvio_percentual: -5 },
    { created_at: '2026-02-01T00:00:00Z', desvio_percentual: -7 },
  ]);

  assert.ok(projection);
  assert.ok(projection.slopePerDay > 0);
  assert.equal(projection.criticalLimit, 10);
  assert.ok(projection.futureDeviations[0] > 7);
  assert.equal(projection.reliable, false);
  assert.equal(projection.status, 'historico_insuficiente');
});

test('não cria tendência com apenas uma medição', () => {
  assert.equal(
    calculateCapacitorTrend([{ created_at: '2026-01-01T00:00:00Z', desvio_percentual: 5 }]),
    null,
  );
});

test('trata pequena oscilação como estabilidade e não cria previsão de longo prazo', () => {
  const trend = calculateCapacitorTrend([
    { created_at: '2026-06-09T00:00:00Z', desvio_percentual: -2.77 },
    { created_at: '2026-08-11T00:00:00Z', desvio_percentual: 2.88 },
  ]);

  assert.equal(trend?.tendencia, 'estavel');
  assert.equal(trend?.previsao, null);
  assert.equal(trend?.statusProjecao, 'historico_insuficiente');
});

test('só libera previsão quando a série atende aos critérios de confiança', () => {
  const trend = calculateCapacitorTrend([
    { created_at: '2026-01-01T00:00:00Z', desvio_percentual: 4 },
    { created_at: '2026-04-01T00:00:00Z', desvio_percentual: 6 },
    { created_at: '2026-07-01T00:00:00Z', desvio_percentual: 8 },
  ]);

  assert.equal(trend?.statusProjecao, 'disponivel');
  assert.ok(trend?.previsao);
  assert.ok((trend?.previsao?.meses || 0) < 36);
  assert.ok((trend?.rQuadrado || 0) > 0.99);
});

test('não apresenta data quando o limite calculado ultrapassa 36 meses', () => {
  const trend = calculateCapacitorTrend([
    { created_at: '2026-01-01T00:00:00Z', desvio_percentual: 5 },
    { created_at: '2026-04-01T00:00:00Z', desvio_percentual: 5.4 },
    { created_at: '2026-07-01T00:00:00Z', desvio_percentual: 5.8 },
  ]);

  assert.equal(trend?.statusProjecao, 'horizonte_excedido');
  assert.equal(trend?.previsao, null);
});

test('bloqueia previsão quando as medições não têm correlação suficiente', () => {
  const trend = calculateCapacitorTrend([
    { created_at: '2026-01-01T00:00:00Z', desvio_percentual: 5 },
    { created_at: '2026-03-02T00:00:00Z', desvio_percentual: 9 },
    { created_at: '2026-05-01T00:00:00Z', desvio_percentual: 5 },
    { created_at: '2026-06-30T00:00:00Z', desvio_percentual: 8 },
  ]);

  assert.equal(trend?.statusProjecao, 'correlacao_fraca');
  assert.equal(trend?.previsao, null);
  assert.ok((trend?.rQuadrado || 1) < 0.6);
});
