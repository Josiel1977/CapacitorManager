import type { CapacitorTrend, ValidationStatus } from '@/lib/domain/capacitorAnalysis';

export type BankAssessmentStatus = ValidationStatus | 'sem_medicao';

export interface BankAssetInput {
  id: string;
  nome_banco?: string | null;
  localizacao?: string | null;
  tensao_nominal?: number | null;
  potencia_total_kvar?: number | null;
  potencia_trafo_kva?: number | null;
  capacitores?: Array<{
    id: string;
    codigo_identificacao?: string | null;
    potencia_kvar?: number | null;
    ativo?: boolean | null;
  }> | null;
}

export interface BankMeasurementInput {
  id?: string;
  capacitor_id?: string | null;
  banco_id?: string | null;
  created_at: string;
  status_validacao?: ValidationStatus | null;
  desvio_percentual?: number | null;
  capacitores?: {
    id?: string | null;
    codigo_identificacao?: string | null;
    potencia_kvar?: number | null;
  } | null;
  bancos_capacitores?: { id?: string | null; nome_banco?: string | null } | null;
  [key: string]: unknown;
}

export interface BankCapacitorReportRow {
  id: string;
  codigo: string;
  potenciaKvar: number;
  status: BankAssessmentStatus;
  ultimaMedicao: BankMeasurementInput | null;
  tendencia: CapacitorTrend | null;
}

export interface BankReportSummary {
  id: string;
  nomeBanco: string;
  localizacao: string | null;
  tensaoNominal: number | null;
  potenciaTrafoKva: number | null;
  potenciaCadastradaKvar: number;
  totalCapacitores: number;
  capacitoresAvaliados: number;
  capacitoresSemMedicao: number;
  coberturaPercentual: number;
  historicosConsolidados: number;
  ultimaInspecao: string | null;
  status: BankAssessmentStatus;
  stats: Record<ValidationStatus, number>;
  capacitores: BankCapacitorReportRow[];
  medicoes: BankMeasurementInput[];
}

function validTimestamp(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function measurementCapacitorId(measurement: BankMeasurementInput): string | null {
  return measurement.capacitor_id || measurement.capacitores?.id || null;
}

function measurementBankId(measurement: BankMeasurementInput): string | null {
  return measurement.banco_id || measurement.bancos_capacitores?.id || null;
}

function normalizedBankName(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Reassocia medições legadas ao cadastro ativo do mesmo banco.
 *
 * Alguns bancos foram recriados ao longo da evolução do sistema e mantiveram
 * as medições no identificador anterior. A reconciliação só acontece quando o
 * nome normalizado encontra exatamente um banco atual, evitando misturar
 * cadastros homônimos.
 */
export function reconcileMeasurementsToBanks(
  banks: BankAssetInput[],
  measurements: BankMeasurementInput[],
): BankMeasurementInput[] {
  const banksById = new Map(banks.map((bank) => [bank.id, bank]));
  const banksByName = new Map<string, BankAssetInput[]>();

  banks.forEach((bank) => {
    const key = normalizedBankName(bank.nome_banco);
    if (!key) return;
    const current = banksByName.get(key) || [];
    current.push(bank);
    banksByName.set(key, current);
  });

  return measurements.map((measurement) => {
    const currentBankId = measurementBankId(measurement);
    let canonicalBank = currentBankId ? banksById.get(currentBankId) : undefined;
    if (!canonicalBank) {
      const key = normalizedBankName(measurement.bancos_capacitores?.nome_banco);
      const candidates = key ? banksByName.get(key) || [] : [];
      if (candidates.length !== 1) return measurement;
      [canonicalBank] = candidates;
    }
    if (!canonicalBank) return measurement;

    const reconciledMeasurement: BankMeasurementInput = {
      ...measurement,
      banco_id: canonicalBank.id,
      bancos_capacitores: {
        ...measurement.bancos_capacitores,
        id: canonicalBank.id,
        nome_banco: canonicalBank.nome_banco || measurement.bancos_capacitores?.nome_banco,
      },
    };

    const registeredCapacitors = canonicalBank.capacitores || [];
    const currentCapacitorId = measurementCapacitorId(measurement);
    if (currentCapacitorId && registeredCapacitors.some((capacitor) => capacitor.id === currentCapacitorId)) {
      return reconciledMeasurement;
    }

    const capacitorKey = normalizedBankName(measurement.capacitores?.codigo_identificacao);
    const capacitorCandidates = capacitorKey
      ? registeredCapacitors.filter((capacitor) => (
        normalizedBankName(capacitor.codigo_identificacao) === capacitorKey
      ))
      : [];
    if (capacitorCandidates.length !== 1) return reconciledMeasurement;

    const [canonicalCapacitor] = capacitorCandidates;
    return {
      ...reconciledMeasurement,
      capacitor_id: canonicalCapacitor.id,
      capacitores: {
        ...measurement.capacitores,
        id: canonicalCapacitor.id,
        codigo_identificacao: canonicalCapacitor.codigo_identificacao
          || measurement.capacitores?.codigo_identificacao,
        potencia_kvar: canonicalCapacitor.potencia_kvar
          ?? measurement.capacitores?.potencia_kvar,
      },
    };
  });
}

function currentBankStatus(stats: Record<ValidationStatus, number>, assessed: number): BankAssessmentStatus {
  if (assessed === 0) return 'sem_medicao';
  if (stats.reprovado > 0) return 'reprovado';
  if (stats.atencao > 0) return 'atencao';
  return 'aprovado';
}

function trendForCapacitor(
  trends: CapacitorTrend[],
  capacitorId: string,
  capacitorCode: string,
  bankId: string,
  bankName: string,
): CapacitorTrend | null {
  return trends.find((trend) => trend.capacitorId === capacitorId)
    || trends.find((trend) => (
      (!trend.bancoId || trend.bancoId === bankId)
      && trend.nome === capacitorCode
      && trend.banco === bankName
    ))
    || null;
}

/**
 * Constrói uma leitura rastreável por banco.
 *
 * A condição considera apenas a última medição de cada capacitor. Cobertura e
 * histórico são mantidos separados para que um item sem dados não seja tratado
 * como aprovado, reprovado ou como uma falsa previsão de falha.
 */
export function buildBankReportSummaries(
  banks: BankAssetInput[],
  measurements: BankMeasurementInput[],
  trends: CapacitorTrend[],
): BankReportSummary[] {
  const latestByCapacitor = new Map<string, BankMeasurementInput>();

  measurements.forEach((measurement) => {
    const capacitorId = measurementCapacitorId(measurement);
    if (!capacitorId) return;
    const current = latestByCapacitor.get(capacitorId);
    if (!current || validTimestamp(measurement.created_at) > validTimestamp(current.created_at)) {
      latestByCapacitor.set(capacitorId, measurement);
    }
  });

  return banks.map((bank) => {
    const bankName = bank.nome_banco?.trim() || 'Banco não identificado';
    const registeredCapacitors = bank.capacitores || [];
    const bankMeasurements = measurements
      .filter((measurement) => measurementBankId(measurement) === bank.id)
      .sort((left, right) => validTimestamp(right.created_at) - validTimestamp(left.created_at));
    const measuredCapacitorsById = new Map<string, {
      id: string;
      codigo_identificacao?: string | null;
      potencia_kvar?: number | null;
      ativo?: boolean | null;
    }>();
    bankMeasurements.forEach((measurement) => {
      const measuredCapacitor = measurement.capacitores;
      if (!measuredCapacitor?.id) return;
      measuredCapacitorsById.set(measuredCapacitor.id, {
        id: measuredCapacitor.id,
        codigo_identificacao: measuredCapacitor.codigo_identificacao,
        potencia_kvar: measuredCapacitor.potencia_kvar,
        ativo: true,
      });
    });
    const measuredCapacitors = Array.from(measuredCapacitorsById.values());
    const capacitorSource = registeredCapacitors.length > 0
      ? registeredCapacitors
      : measuredCapacitors;
    const activeCapacitors = capacitorSource
      .filter((capacitor) => capacitor.ativo !== false)
      .sort((left, right) => (
        (left.codigo_identificacao || '').localeCompare(right.codigo_identificacao || '', 'pt-BR')
      ));

    const capacitors: BankCapacitorReportRow[] = activeCapacitors.map((capacitor) => {
      const latest = latestByCapacitor.get(capacitor.id) || null;
      const status = latest?.status_validacao === 'aprovado'
        || latest?.status_validacao === 'atencao'
        || latest?.status_validacao === 'reprovado'
        ? latest.status_validacao
        : 'sem_medicao';
      const code = capacitor.codigo_identificacao?.trim() || 'Não identificado';

      return {
        id: capacitor.id,
        codigo: code,
        potenciaKvar: Number(capacitor.potencia_kvar) || 0,
        status,
        ultimaMedicao: latest,
        tendencia: trendForCapacitor(trends, capacitor.id, code, bank.id, bankName),
      };
    });

    const stats: Record<ValidationStatus, number> = { aprovado: 0, atencao: 0, reprovado: 0 };
    capacitors.forEach((capacitor) => {
      if (capacitor.status !== 'sem_medicao') stats[capacitor.status] += 1;
    });

    const assessed = stats.aprovado + stats.atencao + stats.reprovado;
    const totalCapacitors = capacitors.length;
    const registeredPower = capacitors.reduce((sum, capacitor) => sum + capacitor.potenciaKvar, 0);
    const lastInspection = bankMeasurements.length > 0 ? bankMeasurements[0].created_at : null;

    return {
      id: bank.id,
      nomeBanco: bankName,
      localizacao: bank.localizacao?.trim() || null,
      tensaoNominal: Number(bank.tensao_nominal) || null,
      potenciaTrafoKva: Number(bank.potencia_trafo_kva) || null,
      potenciaCadastradaKvar: registeredPower > 0
        ? registeredPower
        : Number(bank.potencia_total_kvar) || 0,
      totalCapacitores: totalCapacitors,
      capacitoresAvaliados: assessed,
      capacitoresSemMedicao: Math.max(0, totalCapacitors - assessed),
      coberturaPercentual: totalCapacitors > 0 ? (assessed / totalCapacitors) * 100 : 0,
      historicosConsolidados: capacitors.filter((capacitor) => (
        capacitor.tendencia
        && capacitor.tendencia.statusProjecao !== 'historico_insuficiente'
      )).length,
      ultimaInspecao: lastInspection,
      status: currentBankStatus(stats, assessed),
      stats,
      capacitores: capacitors,
      medicoes: bankMeasurements,
    };
  }).sort((left, right) => left.nomeBanco.localeCompare(right.nomeBanco, 'pt-BR'));
}

/** Distribui bancos sem separar um banco entre duas páginas. */
export function packBankSections(
  banks: BankReportSummary[],
  maximumCapacitorRows = 10,
): BankReportSummary[][] {
  if (banks.length === 0) return [];

  const pages: BankReportSummary[][] = [];
  let currentPage: BankReportSummary[] = [];
  let currentRows = 0;

  banks.forEach((bank) => {
    const bankRows = Math.max(2, bank.capacitores.length);
    if (currentPage.length > 0 && currentRows + bankRows > maximumCapacitorRows) {
      pages.push(currentPage);
      currentPage = [];
      currentRows = 0;
    }

    currentPage.push(bank);
    currentRows += bankRows;
  });

  if (currentPage.length > 0) pages.push(currentPage);
  return pages;
}
