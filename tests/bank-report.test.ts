import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBankReportSummaries,
  packBankSections,
  reconcileMeasurementsToBanks,
} from '../lib/bank-report.ts';

const banks = [
  {
    id: 'bank-b',
    nome_banco: 'Banco B',
    potencia_total_kvar: 50,
    capacitores: [
      { id: 'cap-3', codigo_identificacao: 'CB-01', potencia_kvar: 10, ativo: true },
    ],
  },
  {
    id: 'bank-a',
    nome_banco: 'Banco A',
    potencia_total_kvar: 40,
    capacitores: [
      { id: 'cap-1', codigo_identificacao: 'CA-01', potencia_kvar: 20, ativo: true },
      { id: 'cap-2', codigo_identificacao: 'CA-02', potencia_kvar: 20, ativo: true },
    ],
  },
];

test('resume a condição pela última medição e mantém cobertura separada', () => {
  const summaries = buildBankReportSummaries(banks, [
    {
      id: 'old', banco_id: 'bank-a', capacitor_id: 'cap-1', created_at: '2026-01-01T00:00:00Z',
      status_validacao: 'reprovado', desvio_percentual: 18,
    },
    {
      id: 'new', banco_id: 'bank-a', capacitor_id: 'cap-1', created_at: '2026-02-01T00:00:00Z',
      status_validacao: 'aprovado', desvio_percentual: 1,
    },
  ], []);

  assert.equal(summaries[0].nomeBanco, 'Banco A');
  assert.equal(summaries[0].status, 'aprovado');
  assert.equal(summaries[0].stats.aprovado, 1);
  assert.equal(summaries[0].capacitoresSemMedicao, 1);
  assert.equal(summaries[0].coberturaPercentual, 50);
  assert.equal(summaries[1].status, 'sem_medicao');
});

test('a condição crítica de um componente prevalece no banco avaliado', () => {
  const [summary] = buildBankReportSummaries([banks[1]], [
    {
      banco_id: 'bank-a', capacitor_id: 'cap-1', created_at: '2026-02-01T00:00:00Z',
      status_validacao: 'aprovado',
    },
    {
      banco_id: 'bank-a', capacitor_id: 'cap-2', created_at: '2026-02-01T00:00:00Z',
      status_validacao: 'reprovado',
    },
  ], []);

  assert.equal(summary.status, 'reprovado');
  assert.deepEqual(summary.stats, { aprovado: 1, atencao: 0, reprovado: 1 });
  assert.equal(summary.coberturaPercentual, 100);
});

test('não separa um banco entre páginas do relatório', () => {
  const summaries = buildBankReportSummaries(banks, [], []);
  const pages = packBankSections(summaries, 2);

  assert.equal(pages.length, 2);
  assert.deepEqual(pages.map((page) => page.map((bank) => bank.nomeBanco)), [
    ['Banco A'],
    ['Banco B'],
  ]);
});

test('recupera capacitores pelas medições quando a relação do banco vem vazia', () => {
  const [summary] = buildBankReportSummaries([{
    id: 'bank-poste-b',
    nome_banco: 'POSTE-B',
    capacitores: [],
  }], [{
    id: 'measurement-cpb-01',
    banco_id: 'bank-poste-b',
    capacitor_id: 'cap-cpb-01',
    created_at: '2026-08-11T00:00:00Z',
    status_validacao: 'aprovado',
    capacitores: {
      id: 'cap-cpb-01',
      codigo_identificacao: 'CPB-01',
      potencia_kvar: 10,
    },
  }], []);

  assert.equal(summary.nomeBanco, 'POSTE-B');
  assert.equal(summary.totalCapacitores, 1);
  assert.equal(summary.capacitoresAvaliados, 1);
  assert.equal(summary.stats.aprovado, 1);
  assert.equal(summary.coberturaPercentual, 100);
});

test('não reativa capacitor explicitamente inativo usando o histórico', () => {
  const [summary] = buildBankReportSummaries([{
    id: 'bank-inactive',
    nome_banco: 'Banco inativo',
    capacitores: [{
      id: 'cap-inactive',
      codigo_identificacao: 'CI-01',
      potencia_kvar: 10,
      ativo: false,
    }],
  }], [{
    banco_id: 'bank-inactive',
    capacitor_id: 'cap-inactive',
    created_at: '2026-08-11T00:00:00Z',
    status_validacao: 'aprovado',
    capacitores: {
      id: 'cap-inactive',
      codigo_identificacao: 'CI-01',
      potencia_kvar: 10,
    },
  }], []);

  assert.equal(summary.totalCapacitores, 0);
  assert.equal(summary.capacitoresAvaliados, 0);
});

test('reassocia medição de um identificador legado ao banco atual pelo nome', () => {
  const currentBank = {
    id: 'bank-poste-b-current',
    nome_banco: 'POSTE-B',
    capacitores: [{
      id: 'cpb-01-current',
      codigo_identificacao: 'CPB-01',
      potencia_kvar: 5,
      ativo: true,
    }],
  };
  const reconciled = reconcileMeasurementsToBanks([currentBank], [{
    id: 'measurement-legacy',
    banco_id: 'bank-poste-b-legacy',
    capacitor_id: 'cpb-01-legacy',
    created_at: '2026-08-11T00:00:00Z',
    status_validacao: 'aprovado',
    bancos_capacitores: {
      id: 'bank-poste-b-legacy',
      nome_banco: ' Poste B ',
    },
    capacitores: {
      id: 'cpb-01-legacy',
      codigo_identificacao: 'CPB-01',
      potencia_kvar: 5,
    },
  }]);

  assert.equal(reconciled[0].banco_id, currentBank.id);
  assert.equal(reconciled[0].capacitor_id, 'cpb-01-current');
  const [summary] = buildBankReportSummaries([currentBank], reconciled, []);
  assert.equal(summary.totalCapacitores, 1);
  assert.equal(summary.stats.aprovado, 1);
  assert.equal(summary.coberturaPercentual, 100);
});

test('não adivinha a associação quando há dois bancos atuais com o mesmo nome', () => {
  const reconciled = reconcileMeasurementsToBanks([{
    id: 'bank-a',
    nome_banco: 'POSTE-B',
  }, {
    id: 'bank-b',
    nome_banco: 'POSTE B',
  }], [{
    banco_id: 'legacy-bank',
    created_at: '2026-08-11T00:00:00Z',
    bancos_capacitores: { id: 'legacy-bank', nome_banco: 'POSTE-B' },
  }]);

  assert.equal(reconciled[0].banco_id, 'legacy-bank');
});
