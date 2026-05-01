"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Calculator,
  Zap,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Package,
  History,
  Printer,
  Activity,
  Layers,
  Plus,
  Trash2,
  Save,
  Edit3,
  X,
  Factory,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";

// ============================================
// CONSTANTES
// ============================================
const FP_MINIMO_REGULAMENTAR = 0.92;

// Tarifas de reativo excedente (R$/kVArh) – pode ser sobrescrita pela fatura se necessário
const TARIFAS_REATIVO: Record<string, number> = {
  EQUATORIAL_PARA: 0.28622,
  RORAIMA_ENERGIA: 0.30603,
  DEFAULT: 0.28622,
};

// Tabela de preços de mercado para bancos comerciais (valores médios)
const PRECOS_MERCADO_CAPACITORES: Record<string, { preco_medio: number; faixa_preco: string; fornecedores: string[] }> = {
  "20": { preco_medio: 5400, faixa_preco: "R$ 4.900 - R$ 5.900", fornecedores: ["FASF", "Genérico", "5G"] },
  "30": { preco_medio: 5300, faixa_preco: "R$ 4.800 - R$ 5.800", fornecedores: ["FASF", "5G", "WEG"] },
  "40": { preco_medio: 7067, faixa_preco: "R$ 6.500 - R$ 7.500", fornecedores: ["FASF", "5G"] },
  "50": { preco_medio: 9700, faixa_preco: "R$ 8.900 - R$ 10.500", fornecedores: ["FASF", "5G", "Siemens"] },
  "60": { preco_medio: 11640, faixa_preco: "R$ 10.500 - R$ 12.500", fornecedores: ["FASF", "5G", "WEG"] },
  "70": { preco_medio: 13600, faixa_preco: "R$ 12.500 - R$ 14.800", fornecedores: ["FASF", "ABB"] },
  "80": { preco_medio: 14500, faixa_preco: "R$ 13.500 - R$ 15.500", fornecedores: ["FASF", "5G"] },
  "90": { preco_medio: 15300, faixa_preco: "R$ 14.000 - R$ 16.500", fornecedores: ["FASF", "5G"] },
  "100": { preco_medio: 18700, faixa_preco: "R$ 17.500 - R$ 19.900", fornecedores: ["5G", "FASF", "WEG"] },
  "120": { preco_medio: 21500, faixa_preco: "R$ 19.900 - R$ 23.000", fornecedores: ["FASF", "5G"] },
  "150": { preco_medio: 25500, faixa_preco: "R$ 23.500 - R$ 27.500", fornecedores: ["5G", "WEG"] },
  "180": { preco_medio: 26900, faixa_preco: "R$ 24.900 - R$ 28.900", fornecedores: ["FASF", "5G"] },
  "210": { preco_medio: 27300, faixa_preco: "R$ 25.500 - R$ 29.500", fornecedores: ["FASF", "5G"] },
  "240": { preco_medio: 28500, faixa_preco: "R$ 26.500 - R$ 30.500", fornecedores: ["FASF"] },
  "280": { preco_medio: 29600, faixa_preco: "R$ 27.500 - R$ 31.500", fornecedores: ["FASF"] },
  "300": { preco_medio: 32500, faixa_preco: "R$ 30.000 - R$ 35.000", fornecedores: ["WEG", "ABB"] },
};

const FORNECEDORES_RECOMENDADOS = [
  { nome: "WEG", site: "www.weg.net", especialidade: "Equipamentos industriais premium" },
  { nome: "FASF", site: "www.fasf.com.br", especialidade: "Bancos de capacitores especializados" },
  { nome: "5G Equipamentos", site: "www.5geq.com.br", especialidade: "Custo-benefício" },
  { nome: "ABB", site: "new.abb.com/br", especialidade: "Tecnologia suíça" },
  { nome: "Siemens", site: "www.siemens.com/br", especialidade: "Automação e energia" },
];

const CONFIG_CAPACITORES = {
  tensao_padrao_380v: "440V",
  tensao_padrao_220v: "260V",
  minimo_kvar_grupo_a: 20,
  minimo_kvar_grupo_b: 10,
  dessintonia_padrao: 7,
  // Valores comerciais para composição de estágios (ordem decrescente)
  tamanhos_estagios: [60, 50, 40, 30, 20, 15, 10, 7.5, 5, 2.5],
};

// ============================================
// INTERFACES
// ============================================
interface Transformador {
  id: string;
  potencia_kva: number;
  quantidade: number;
  tensao_v: number;
  horas_trabalho: number;
}

interface Fatura {
  id: string;
  mes_referencia: string;
  consumo_ponta_kwh: number;
  consumo_fora_ponta_kwh: number;
  demanda_ponta_kw: number;
  demanda_fora_ponta_kw: number;
  reativo_ponta_kvarh: number;
  reativo_fora_ponta_kvarh: number;
  total_pagar: number;
  dias_ciclo: number;
  concessionaria: string;
  fp_calculado?: number;
  validado: boolean;
  multa_calculada?: number;   // calculada automaticamente
  multa_informada?: number;    // opcional para override
}

interface DistribuicaoTrafo {
  trafo_kva: number;
  percentual: number;
  kvar_recomendado: number;
  kvar_comercial: number;
  preco_estimado: number;
  configuracao_estagios: string;
}

interface ResultadoDimensionamento {
  // Banco fixo (célula capacitiva)
  banco_fixo_kvar: number;
  banco_automatico_kvar: number;
  kvar_total_comercial: number;
  // Estágios do banco automático
  estagios_automaticos: number[];
  tensao_capacitores: string;
  fator_dessintonia: number;
  economia_mensal_estimada: number;
  investimento_estimado_total: number;
  payback_meses: number;
  fp_atual_percent: number;
  fp_projetado_percent: number;
  multa_atual_mensal_real: number;
  potencia_ativa_utilizada_kw: number;
  precisa_capacitor: boolean;
  grupo_tarifario: "A" | "B";
  motivo_recomendacao: string;
  concessionaria_identificada: string;
  quantidade_faturas_analisadas: number;
  pior_mes: Fatura | null;
  media_fp_por_mes: Array<{ mes: string; fp: number; multa: number }>;
  alertas: string[];
  distribuicao_por_trafo: DistribuicaoTrafo[];
  fornecedores_recomendados: typeof FORNECEDORES_RECOMENDADOS;
  preco_por_kvar: number;
  economia_anual: number;
  retorno_5_anos: number;
  prejuizo_acumulado: number;
  projecao_1_ano: number;
  projecao_3_anos: number;
  projecao_5_anos: number;
  roi_5_anos_percent: number;
  metodo_calculo_utilizado: string;
  fator_carga_utilizado: number;
  correcao_fixa_percent: number;
  numero_estagios: number;
}

// ============================================
// UTILITÁRIOS
// ============================================
const parseBRLocal = (valor: string | number | undefined): number => {
  if (valor === undefined || valor === null) return 0;
  if (typeof valor === "number") return valor;
  if (valor === "") return 0;
  let limpo = valor.toString().trim();
  limpo = limpo.replace(/[^\d,.-]/g, "");
  if (limpo.includes(".") && limpo.includes(",")) {
    limpo = limpo.replace(/\./g, "").replace(",", ".");
  } else if (limpo.includes(",")) {
    limpo = limpo.replace(",", ".");
  }
  const numero = parseFloat(limpo);
  return isNaN(numero) ? 0 : numero;
};

const formatMoney = (valor: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const formatNumber = (valor: number, decimals: number = 2): string =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(valor);

const parseMesReferencia = (mesRef: string): number => {
  const [mesStr, anoStr] = (mesRef || "").split("/");
  const mes = Number(mesStr);
  const ano = Number(anoStr);
  if (!Number.isFinite(mes) || !Number.isFinite(ano) || mes < 1 || mes > 12) return Number.NEGATIVE_INFINITY;
  return ano * 100 + mes;
};

const calcularFatorPotencia = (ativo_kwh: number, reativo_kvarh: number): number => {
  if (ativo_kwh <= 0) return 0.92;
  const aparente = Math.sqrt(ativo_kwh ** 2 + reativo_kvarh ** 2);
  return aparente === 0 ? 0.92 : Math.min(0.99, Math.max(0.3, ativo_kwh / aparente));
};

// Calcula a multa com base no reativo excedente e na tarifa da concessionária
const calcularMultaDaFatura = (fatura: Fatura): number => {
  const reativoExcedenteTotal = fatura.reativo_ponta_kvarh + fatura.reativo_fora_ponta_kvarh;
  const tarifa = TARIFAS_REATIVO[fatura.concessionaria as keyof typeof TARIFAS_REATIVO] ?? TARIFAS_REATIVO.DEFAULT;
  return reativoExcedenteTotal * tarifa;
};

// Fórmula clássica para kVAr necessários
const calcularKvarNecessario = (potencia_ativa_kw: number, fp_atual: number, fp_desejado: number): number => {
  const fp_atual_seguro = Math.min(0.99, Math.max(0.3, fp_atual));
  const fp_desejado_seguro = Math.min(0.99, Math.max(fp_desejado, FP_MINIMO_REGULAMENTAR));
  const angulo_atual = Math.acos(fp_atual_seguro);
  const angulo_desejado = Math.acos(fp_desejado_seguro);
  let kvar = potencia_ativa_kw * (Math.tan(angulo_atual) - Math.tan(angulo_desejado));
  kvar = Math.max(0, kvar);
  return Math.ceil(kvar / 2.5) * 2.5;
};

// Distribuição dos estágios do banco automático (6-8 estágios)
const distribuirEstagios = (total_kvar: number, numEstagios: number): number[] => {
  const n = Math.min(8, Math.max(6, numEstagios)); // entre 6 e 8
  let restante = total_kvar;
  const stages: number[] = [];
  const tamanhos = [...CONFIG_CAPACITORES.tamanhos_estagios]; // cópia decrescente

  for (const size of tamanhos) {
    while (restante >= size && stages.length < n) {
      stages.push(size);
      restante -= size;
    }
  }
  // Se ainda há excedente e espaço, adiciona um estágio com o valor restante (arredondado para múltiplo de 2.5)
  if (restante >= 2.5 && stages.length < n) {
    stages.push(Math.ceil(restante / 2.5) * 2.5);
  }
  // Ordena crescente
  return stages.sort((a, b) => a - b);
};

// Preço de mercado baseado no valor comercial do banco automático
const calcularPrecoMercado = (kvar: number): number => {
  const potencias = Object.keys(PRECOS_MERCADO_CAPACITORES).map(Number).sort((a, b) => a - b);
  let maisProximo = potencias[0];
  let menorDiferenca = Math.abs(kvar - maisProximo);
  for (const p of potencias) {
    const diff = Math.abs(kvar - p);
    if (diff < menorDiferenca) { menorDiferenca = diff; maisProximo = p; }
  }
  const preco = PRECOS_MERCADO_CAPACITORES[maisProximo.toString()]?.preco_medio || 25000;
  return kvar !== maisProximo ? Math.round(kvar * (preco / maisProximo)) : preco;
};

// Distribuição proporcional entre transformadores (apenas para o banco automático)
const distribuirKvarPorTrafo = (transformadores: Transformador[], kvarTotalComercial: number): DistribuicaoTrafo[] => {
  const potenciaTotal = transformadores.reduce((acc, t) => acc + t.potencia_kva * t.quantidade, 0);
  if (potenciaTotal <= 0 || kvarTotalComercial <= 0) return [];
  return transformadores.map((trafo) => {
    const potenciaTrafo = trafo.potencia_kva * trafo.quantidade;
    const percentual = potenciaTrafo / potenciaTotal;
    let kvarRecomendado = kvarTotalComercial * percentual;
    let kvarComercial = Math.ceil(kvarRecomendado / 10) * 10;
    if (kvarComercial < 10 && kvarRecomendado > 0) kvarComercial = 10;
    const precoEstimado = calcularPrecoMercado(kvarComercial);
    let configuracaoEstagios = "";
    if (kvarComercial <= 30) configuracaoEstagios = `${kvarComercial} kVAr (estágio único)`;
    else if (kvarComercial <= 60) configuracaoEstagios = `${Math.round(kvarComercial / 2)} + ${Math.round(kvarComercial / 2)} kVAr`;
    else if (kvarComercial <= 100) configuracaoEstagios = `${Math.round(kvarComercial / 3)} + ${Math.round(kvarComercial / 3)} + ${Math.round(kvarComercial / 3)} kVAr`;
    else configuracaoEstagios = `${Math.round(kvarComercial / 0.6 / 100) * 60} + ${kvarComercial - Math.round(kvarComercial / 0.6 / 100) * 60} kVAr`;
    return {
      trafo_kva: potenciaTrafo,
      percentual: percentual * 100,
      kvar_recomendado: kvarRecomendado,
      kvar_comercial: kvarComercial,
      preco_estimado: precoEstimado,
      configuracao_estagios: configuracaoEstagios,
    };
  });
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function DimensionarPage() {
  const reportRef = useRef<HTMLDivElement>(null);
  const [transformadores, setTransformadores] = useState<Transformador[]>([
    { id: "1", potencia_kva: 300, quantidade: 1, tensao_v: 380, horas_trabalho: 220 },
    { id: "2", potencia_kva: 225, quantidade: 1, tensao_v: 380, horas_trabalho: 220 },
  ]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [targetFP, setTargetFP] = useState<number>(0.92);
  const [result, setResult] = useState<ResultadoDimensionamento | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [showFaturaModal, setShowFaturaModal] = useState(false);
  const [currentFatura, setCurrentFatura] = useState<Partial<Fatura>>({});
  const [editandoFaturaId, setEditandoFaturaId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [fatorCarga, setFatorCarga] = useState<number>(0.65); // padrão 65%
  const [correcaoFixaPercent, setCorrecaoFixaPercent] = useState<number>(5); // 5% da potência dos trafos
  const [numeroEstagios, setNumeroEstagios] = useState<number>(6); // entre 6 e 8

  const carregarDados = useCallback(() => {
    try {
      const savedTrafos = localStorage.getItem("dimensionar_transformadores");
      if (savedTrafos) setTransformadores(JSON.parse(savedTrafos));
      const savedFaturas = localStorage.getItem("dimensionar_faturas");
      if (savedFaturas) {
        const loaded = JSON.parse(savedFaturas);
        const faturasComMulta = loaded.map((f: Fatura) => ({
          ...f,
          multa_calculada: calcularMultaDaFatura(f),
        }));
        setFaturas(faturasComMulta);
      } else {
        carregarFaturaExemploReal();
      }
    } catch (error) { console.error(error); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => carregarDados(), [carregarDados]);

  const carregarFaturaExemploReal = () => {
    // Dados reais das faturas Equatorial Pará (WG ARMAZENS GERAIS)
    const faturasRaw: Fatura[] = [
      {
        id: "nov2025",
        mes_referencia: "11/2025",
        consumo_ponta_kwh: 457.21,
        consumo_fora_ponta_kwh: 5179.86,
        demanda_ponta_kw: 53.42,
        demanda_fora_ponta_kw: 53.42,
        reativo_ponta_kvarh: 493.76,
        reativo_fora_ponta_kvarh: 4696.54,
        total_pagar: 12617.5,
        dias_ciclo: 30,
        concessionaria: "EQUATORIAL_PARA",
        validado: true,
      },
      {
        id: "dez2025",
        mes_referencia: "12/2025",
        consumo_ponta_kwh: 595.56,
        consumo_fora_ponta_kwh: 6106.21,
        demanda_ponta_kw: 40.66,
        demanda_fora_ponta_kw: 40.66,
        reativo_ponta_kvarh: 1130.49,
        reativo_fora_ponta_kvarh: 8932.83,
        total_pagar: 14486.71,
        dias_ciclo: 31,
        concessionaria: "EQUATORIAL_PARA",
        validado: true,
      },
      {
        id: "jan2026",
        mes_referencia: "01/2026",
        consumo_ponta_kwh: 558.52,
        consumo_fora_ponta_kwh: 5974.5,
        demanda_ponta_kw: 37.96,
        demanda_fora_ponta_kw: 39.98,
        reativo_ponta_kvarh: 993.0,
        reativo_fora_ponta_kvarh: 8690.47,
        total_pagar: 13728.12,
        dias_ciclo: 31,
        concessionaria: "EQUATORIAL_PARA",
        validado: true,
      },
    ];
    const faturasComMulta = faturasRaw.map(f => ({
      ...f,
      multa_calculada: calcularMultaDaFatura(f),
    }));
    setFaturas(faturasComMulta);
    localStorage.setItem("dimensionar_faturas", JSON.stringify(faturasComMulta));
  };

  const salvarFatura = async () => {
    if (!currentFatura.mes_referencia) {
      Swal.fire({ title: "Atenção", text: "Informe o mês de referência", icon: "warning" });
      return;
    }
    const consumoPonta = parseBRLocal(currentFatura.consumo_ponta_kwh);
    const consumoForaPonta = parseBRLocal(currentFatura.consumo_fora_ponta_kwh);
    const reativoPonta = parseBRLocal(currentFatura.reativo_ponta_kvarh);
    const reativoForaPonta = parseBRLocal(currentFatura.reativo_fora_ponta_kvarh);
    const demandaPonta = parseBRLocal(currentFatura.demanda_ponta_kw);
    const demandaForaPonta = parseBRLocal(currentFatura.demanda_fora_ponta_kw);
    const totalPagar = parseBRLocal(currentFatura.total_pagar);
    const diasCiclo = parseInt(currentFatura.dias_ciclo?.toString() || "30") || 30;
    const concessionaria = (currentFatura.concessionaria as string) || "EQUATORIAL_PARA";
    const multaInformada = parseBRLocal(currentFatura.multa_informada);

    const novaFaturaRaw: Fatura = {
      id: editandoFaturaId || Date.now().toString(),
      mes_referencia: currentFatura.mes_referencia as string,
      consumo_ponta_kwh: consumoPonta,
      consumo_fora_ponta_kwh: consumoForaPonta,
      demanda_ponta_kw: demandaPonta,
      demanda_fora_ponta_kw: demandaForaPonta,
      reativo_ponta_kvarh: reativoPonta,
      reativo_fora_ponta_kvarh: reativoForaPonta,
      total_pagar: totalPagar,
      dias_ciclo: diasCiclo,
      concessionaria: concessionaria,
      validado: true,
      multa_informada: multaInformada || undefined,
    };
    const multaCalculada = calcularMultaDaFatura(novaFaturaRaw);
    const novaFatura = { ...novaFaturaRaw, multa_calculada: multaCalculada };

    const confirmar = await Swal.fire({
      title: "Confirmar dados?",
      html: `<div class="text-left"><p><strong>Mês:</strong> ${novaFatura.mes_referencia}</p><p><strong>Consumo Total:</strong> ${formatNumber(consumoPonta + consumoForaPonta, 0)} kWh</p><p><strong>Reativo Excedente Total:</strong> ${formatNumber(reativoPonta + reativoForaPonta, 0)} kVArh</p><p><strong>FP calculado:</strong> ${(calcularFatorPotencia(consumoPonta + consumoForaPonta, reativoPonta + reativoForaPonta) * 100).toFixed(1)}%</p><p><strong>Multa calculada:</strong> ${formatMoney(multaCalculada)}</p>${multaInformada ? `<p><strong>Multa informada:</strong> ${formatMoney(multaInformada)}</p>` : ''}</div>`,
      icon: "question", showCancelButton: true, confirmButtonText: "Salvar", cancelButtonText: "Revisar",
    });
    if (!confirmar.isConfirmed) return;

    let novasFaturas = editandoFaturaId ? faturas.map(f => f.id === editandoFaturaId ? novaFatura : f) : [novaFatura, ...faturas];
    novasFaturas.sort((a, b) => parseMesReferencia(b.mes_referencia) - parseMesReferencia(a.mes_referencia));
    setFaturas(novasFaturas);
    localStorage.setItem("dimensionar_faturas", JSON.stringify(novasFaturas));
    setShowFaturaModal(false);
    setCurrentFatura({});
    setEditandoFaturaId(null);
    Swal.fire({ title: "✅ Sucesso!", text: "Fatura salva!", icon: "success", timer: 1500 });
  };

  const removerFatura = (id: string) => {
    Swal.fire({
      title: "Remover fatura?",
      text: "Esta ação não pode ser desfeita.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#e74c3c",
      confirmButtonText: "Remover",
    }).then((result) => {
      if (result.isConfirmed) {
        const novasFaturas = faturas.filter(f => f.id !== id);
        setFaturas(novasFaturas);
        localStorage.setItem("dimensionar_faturas", JSON.stringify(novasFaturas));
        Swal.fire({ title: "Removida!", text: "Fatura removida com sucesso.", icon: "success" });
      }
    });
  };

  const salvarTransformadores = () => {
    localStorage.setItem("dimensionar_transformadores", JSON.stringify(transformadores));
    Swal.fire({ title: "✅ Sucesso!", text: "Configuração dos transformadores salva!", icon: "success", timer: 1500 });
  };

  const adicionarTransformador = () => setTransformadores([...transformadores, { id: (transformadores.length + 1).toString(), potencia_kva: 100, quantidade: 1, tensao_v: 220, horas_trabalho: 220 }]);
  const removerTransformador = (idx: number) => { if (transformadores.length > 1) setTransformadores(transformadores.filter((_, i) => i !== idx)); };
  const atualizarTransformador = (idx: number, field: keyof Transformador, value: number) => { const novos = [...transformadores]; novos[idx] = { ...novos[idx], [field]: value }; setTransformadores(novos); };
  const potenciaTotalTransformadores = transformadores.reduce((acc, t) => acc + t.potencia_kva * t.quantidade, 0);

  const calcularDimensionamento = () => {
    if (faturas.length < 2) {
      Swal.fire({ title: "Atenção", text: "Mínimo de 2 faturas para dimensionamento confiável", icon: "warning" });
      return;
    }
    setCalculando(true);
    try {
      const alertas: string[] = [];
      const concessionarias = [...new Set(faturas.map(f => f.concessionaria))];
      if (concessionarias.length > 1) alertas.push(`⚠️ Faturas de diferentes concessionárias: ${concessionarias.join(", ")}`);

      // Processa faturas
      const faturasProcessadas = faturas.map(f => {
        const ativoTotal = f.consumo_ponta_kwh + f.consumo_fora_ponta_kwh;
        const reativoTotal = f.reativo_ponta_kvarh + f.reativo_fora_ponta_kvarh;
        const fp = calcularFatorPotencia(ativoTotal, reativoTotal);
        const multa = f.multa_informada ?? f.multa_calculada ?? 0;
        const demandaMaxKw = Math.max(f.demanda_ponta_kw, f.demanda_fora_ponta_kw, 0.1);
        return { ...f, ativoTotal, reativoTotal, fp, multa, demandaMaxKw };
      });

      const piorMes = faturasProcessadas.reduce((prev, curr) => curr.fp < prev.fp ? curr : prev, faturasProcessadas[0]);
      const fpAtual = piorMes.fp;
      const fpDesejado = targetFP;
      const mediaMulta = faturasProcessadas.reduce((acc, f) => acc + f.multa, 0) / faturasProcessadas.length;
      const demandaMaxRegistrada = Math.max(...faturasProcessadas.map(f => f.demandaMaxKw));

      // Estimativa da potência ativa por fator de carga
      const potenciaInstaladaKVA = potenciaTotalTransformadores;
      const potenciaAtivaEstimada = potenciaInstaladaKVA * fatorCarga * fpAtual;
      const potenciaAtivaFinal = Math.max(demandaMaxRegistrada, potenciaAtivaEstimada);

      const precisaCapacitor = fpAtual < FP_MINIMO_REGULAMENTAR || mediaMulta > 200;

      let kvarAutomatico = 0;
      let kvarTotalComercial = 0;
      let estagios: number[] = [];
      let economiaMensal = 0;
      let motivo = "";

      if (precisaCapacitor) {
        // Cálculo do banco automático (compensação da carga variável)
        kvarAutomatico = calcularKvarNecessario(potenciaAtivaFinal, fpAtual, fpDesejado);
        kvarAutomatico = Math.ceil(kvarAutomatico / 10) * 10;
        kvarAutomatico = Math.max(kvarAutomatico, CONFIG_CAPACITORES.minimo_kvar_grupo_a);
        // Distribuição dos estágios automáticos
        estagios = distribuirEstagios(kvarAutomatico, numeroEstagios);
        economiaMensal = mediaMulta * 0.92;
        kvarTotalComercial = kvarAutomatico;
        motivo = `Potência ativa baseada na demanda medida (${demandaMaxRegistrada.toFixed(1)} kW) e fator de carga (${fatorCarga.toFixed(2)}): estimativa final = ${potenciaAtivaFinal.toFixed(1)} kW | FP atual = ${(fpAtual * 100).toFixed(1)}% | Meta = ${(fpDesejado * 100).toFixed(0)}% | kVAr automático = P × (tanφ1 - tanφ2) = ${kvarAutomatico.toFixed(1)} kVAr.`;
      } else {
        const mediaFp = faturasProcessadas.reduce((a,b)=>a+b.fp,0)/faturasProcessadas.length;
        motivo = `✅ Sistema regularizado (FP médio: ${(mediaFp * 100).toFixed(1)}%)`;
      }

      // Banco fixo (célula capacitiva)
      const correcaoFixaKvar = (potenciaTotalTransformadores * correcaoFixaPercent) / 100;
      const investimentoFixo = calcularPrecoMercado(correcaoFixaKvar);
      const investimentoAutomatico = calcularPrecoMercado(kvarAutomatico);
      const investimentoTotal = investimentoFixo + investimentoAutomatico;

      const payback = economiaMensal > 0 ? Math.ceil(investimentoTotal / economiaMensal) : 99;
      const economiaAnual = economiaMensal * 12;
      const retorno5Anos = economiaAnual * 5 - investimentoTotal;
      const prejuizoAcumulado = faturasProcessadas.reduce((acc, f) => acc + f.multa, 0);
      const projecao1Ano = economiaAnual - investimentoTotal;
      const projecao3Anos = economiaAnual * 3 - investimentoTotal;
      const projecao5Anos = retorno5Anos;
      const roi5AnosPercent = investimentoTotal > 0 ? (projecao5Anos / investimentoTotal) * 100 : 0;
      const precoPorKvar = kvarTotalComercial > 0 ? investimentoAutomatico / kvarTotalComercial : 0;
      const distribuicaoPorTrafo = distribuirKvarPorTrafo(transformadores, kvarAutomatico);
      const tensaoCapacitores = transformadores[0]?.tensao_v === 380 ? CONFIG_CAPACITORES.tensao_padrao_380v : CONFIG_CAPACITORES.tensao_padrao_220v;
      const mediaFpPorMes = faturasProcessadas.map(f => ({ mes: f.mes_referencia, fp: f.fp * 100, multa: f.multa })).sort((a, b) => a.fp - b.fp);
      const grupoTarifario = potenciaTotalTransformadores >= 75 ? "A" : "B";

      setResult({
        banco_fixo_kvar: correcaoFixaKvar,
        banco_automatico_kvar: kvarAutomatico,
        kvar_total_comercial: kvarTotalComercial,
        estagios_automaticos: estagios,
        tensao_capacitores: tensaoCapacitores,
        fator_dessintonia: CONFIG_CAPACITORES.dessintonia_padrao,
        economia_mensal_estimada: economiaMensal,
        investimento_estimado_total: investimentoTotal,
        payback_meses: payback,
        fp_atual_percent: fpAtual * 100,
        fp_projetado_percent: precisaCapacitor ? fpDesejado * 100 : fpAtual * 100,
        multa_atual_mensal_real: mediaMulta,
        potencia_ativa_utilizada_kw: potenciaAtivaFinal,
        precisa_capacitor: precisaCapacitor,
        grupo_tarifario: grupoTarifario,
        motivo_recomendacao: motivo,
        concessionaria_identificada: concessionarias[0] || "NÃO IDENTIFICADA",
        quantidade_faturas_analisadas: faturasProcessadas.length,
        pior_mes: piorMes ? { ...piorMes, fp_calculado: piorMes.fp, multa_calculada: piorMes.multa } : null,
        media_fp_por_mes: mediaFpPorMes,
        alertas: alertas,
        distribuicao_por_trafo: distribuicaoPorTrafo,
        fornecedores_recomendados: FORNECEDORES_RECOMENDADOS,
        preco_por_kvar: precoPorKvar,
        economia_anual: economiaAnual,
        retorno_5_anos: retorno5Anos,
        prejuizo_acumulado: prejuizoAcumulado,
        projecao_1_ano: projecao1Ano,
        projecao_3_anos: projecao3Anos,
        projecao_5_anos: projecao5Anos,
        roi_5_anos_percent: roi5AnosPercent,
        metodo_calculo_utilizado: "Fórmula clássica P×Δtan + célula capacitiva fixa",
        fator_carga_utilizado: fatorCarga,
        correcao_fixa_percent: correcaoFixaPercent,
        numero_estagios: numeroEstagios,
      });

      Swal.fire({
        title: precisaCapacitor ? "✅ Dimensionamento Concluído" : "✅ Análise Concluída",
        html: `<div class="text-center"><p class="text-lg font-bold">FP no pior mês: ${(fpAtual * 100).toFixed(1)}%</p>${precisaCapacitor ? `<p class="text-primary font-bold mt-2">🔋 Recomendação:<br/>• Banco fixo: ${formatNumber(correcaoFixaKvar, 1)} kVAr<br/>• Banco automático: ${kvarAutomatico.toFixed(1)} kVAr (${estagios.length} estágios)<br/>• Total: ${formatNumber(correcaoFixaKvar + kvarAutomatico, 1)} kVAr</p>` : '<p class="text-green-600 mt-2">Sistema dentro das normas ANEEL</p>'}<p class="text-xs text-slate-500 mt-2">💰 Multa média: ${formatMoney(mediaMulta)}/mês</p><p class="text-xs text-slate-500">💰 Investimento total estimado: ${formatMoney(investimentoTotal)}</p><p class="text-xs text-slate-500">⏱️ Payback: ${payback} meses</p></div>`,
        icon: precisaCapacitor ? "success" : "info",
        timer: 6000,
      });
    } catch (error) { console.error(error); Swal.fire({ title: "Erro", text: "Falha ao processar dimensionamento", icon: "error" }); }
    finally { setCalculando(false); }
  };

  const exportMemorial = async () => {
    if (!reportRef.current) return;
    try {
      Swal.fire({ title: "Gerando PDF...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
      const element = reportRef.current;
      const dataUrl = await toPng(element, { quality: 1.0, backgroundColor: "#ffffff", pixelRatio: 2 });
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
      const pdfHeight = pdf.internal.pageSize.getHeight() - 20;
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });
      const imgWidth = pdfWidth;
      const imgHeight = (img.height * imgWidth) / img.width;
      let position = 0;
      let heightLeft = imgHeight;
      let page = 1;
      pdf.addImage(dataUrl, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
      while (heightLeft > 0) {
        position = position - pdfHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, "PNG", 10, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
        page++;
      }
      pdf.save(`Dimensionamento_Capacitor_${new Date().toISOString().slice(0, 10)}.pdf`);
      Swal.close();
      Swal.fire({ title: "PDF gerado!", text: `Memorial exportado em ${page} página(s).`, icon: "success" });
    } catch (error) {
      Swal.close();
      Swal.fire({ title: "Erro", text: "Falha ao gerar PDF", icon: "error" });
    }
  };

  if (carregando) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-primary" size={32} /></div>;

  const BarraFP = ({ fp, meta = 92 }: { fp: number; meta?: number }) => {
    const percentual = Math.min(100, Math.max(0, (fp / meta) * 100));
    const cor = fp >= 92 ? "bg-green-500" : fp >= 80 ? "bg-amber-500" : "bg-red-500";
    return <div className="w-full bg-slate-200 rounded-full h-2"><div className={`${cor} h-2 rounded-full`} style={{ width: `${percentual}%` }} /></div>;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-primary">Dimensionamento de Banco de Capacitores</h1>
        <p className="text-slate-500 mt-2">Análise baseada em faturas - WG ARMAZENS GERAIS</p>
        <p className="text-xs text-slate-400 mt-1">Infraestrutura: 1x300kVA + 1x225kVA | 380V | Grupo A4</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Painel esquerdo - configurações */}
        <div className="lg:col-span-5 space-y-6">
          {/* Transformadores */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border">
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold text-primary flex gap-2"><Package size={20} /> Transformadores</h2><button onClick={salvarTransformadores} className="text-xs bg-primary text-white px-3 py-1 rounded-lg"><Save size={12} /> Salvar</button></div>
            <div className="space-y-3">
              {transformadores.map((trafo, idx) => (
                <div key={trafo.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="flex-1 flex gap-2">
                    <div><label className="text-[8px] font-black">Potência (kVA)</label><input type="number" value={trafo.potencia_kva} onChange={(e) => atualizarTransformador(idx, "potencia_kva", parseFloat(e.target.value) || 0)} className="w-full rounded-lg border p-2 text-sm" /></div>
                    <div><label className="text-[8px] font-black">Qtd</label><input type="number" value={trafo.quantidade} onChange={(e) => atualizarTransformador(idx, "quantidade", parseInt(e.target.value) || 0)} className="w-full rounded-lg border p-2 text-sm" /></div>
                    <div><label className="text-[8px] font-black">Tensão (V)</label><input type="number" value={trafo.tensao_v} onChange={(e) => atualizarTransformador(idx, "tensao_v", parseFloat(e.target.value) || 380)} className="w-full rounded-lg border p-2 text-sm" /></div>
                  </div>
                  {transformadores.length > 1 && <button onClick={() => removerTransformador(idx)} className="text-red-400"><Trash2 size={16} /></button>}
                </div>
              ))}
              <button onClick={adicionarTransformador} className="w-full py-2 border-2 border-dashed rounded-xl text-slate-400 text-xs"><Plus size={14} /> Adicionar Transformador</button>
            </div>
            <div className="mt-4 p-3 bg-primary/5 rounded-xl"><div className="flex justify-between text-sm"><span>Potência Total Instalada:</span><span className="font-bold text-primary">{formatNumber(potenciaTotalTransformadores, 0)} kVA</span></div><div className="text-xs text-slate-500 mt-1">{transformadores.map(t => `${t.quantidade}x${t.potencia_kva}kVA`).join(" + ")} | {transformadores[0]?.tensao_v}V</div></div>
          </div>

          {/* Faturas */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border">
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold text-primary flex gap-2"><History size={20} /> Faturas ({faturas.length})</h2><button onClick={() => { setCurrentFatura({}); setEditandoFaturaId(null); setShowFaturaModal(true); }} className="text-xs bg-primary text-white px-3 py-1 rounded-lg"><Plus size={12} /> Adicionar</button></div>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {faturas.length === 0 ? <div className="text-center py-8"><p>Nenhuma fatura</p><button onClick={carregarFaturaExemploReal} className="text-primary text-sm">Carregar dados reais da WG ARMAZENS GERAIS →</button></div> :
                faturas.map(fat => {
                  const ativo = fat.consumo_ponta_kwh + fat.consumo_fora_ponta_kwh;
                  const reativo = fat.reativo_ponta_kvarh + fat.reativo_fora_ponta_kvarh;
                  const fp = calcularFatorPotencia(ativo, reativo);
                  const multa = fat.multa_informada ?? fat.multa_calculada ?? 0;
                  return (
                    <div key={fat.id} className="p-3 rounded-lg bg-slate-50">
                      <div className="flex justify-between"><span className="font-bold">{fat.mes_referencia}</span><div><button onClick={() => { setCurrentFatura(fat); setEditandoFaturaId(fat.id); setShowFaturaModal(true); }} className="text-blue-500"><Edit3 size={14} /></button><button onClick={() => removerFatura(fat.id)} className="text-red-500"><Trash2 size={14} /></button></div></div>
                      <div className="grid grid-cols-2 gap-1 text-xs mt-2"><div>Consumo Ponta: {formatNumber(fat.consumo_ponta_kwh, 2)} kWh</div><div>Consumo F/Ponta: {formatNumber(fat.consumo_fora_ponta_kwh, 2)} kWh</div><div>Reativo Ponta: {formatNumber(fat.reativo_ponta_kvarh, 2)} kVArh</div><div>Reativo F/Ponta: {formatNumber(fat.reativo_fora_ponta_kvarh, 2)} kVArh</div><div className="col-span-2"><span className={`text-xs font-bold ${fp >= 0.92 ? "text-green-600" : "text-red-600"}`}>FP: {(fp * 100).toFixed(1)}%</span> <span className="ml-2 text-red-500">Multa: {formatMoney(multa)}</span></div></div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Configurações avançadas */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border">
            <label className="block text-sm font-medium mb-2">Fator de Potência Desejado</label>
            <select value={targetFP} onChange={(e) => setTargetFP(parseFloat(e.target.value))} className="w-full rounded-xl border p-3 mb-4"><option value={0.92}>0.92 (mínimo ANEEL)</option><option value={0.95}>0.95 (recomendado)</option><option value={0.98}>0.98 (excelente)</option></select>
            <details className="mb-4"><summary className="text-sm font-medium cursor-pointer text-primary">⚙️ Configurações Avançadas</summary>
              <div className="mt-3 space-y-4 p-3 bg-slate-50 rounded-lg">
                <div>
                  <label className="text-xs text-slate-600">Fator de Carga (carga média / potência instalada)</label>
                  <input type="range" min="0.3" max="0.9" step="0.05" value={fatorCarga} onChange={(e) => setFatorCarga(parseFloat(e.target.value))} className="w-full" />
                  <div className="flex justify-between text-xs"><span>0.3</span><span className="font-bold">{fatorCarga.toFixed(2)}</span><span>0.9</span></div>
                  <p className="text-[10px] text-slate-500">Valor típico para armazéns: 0,65. Aumente se a carga média for maior.</p>
                </div>
                <div>
                  <label className="text-xs text-slate-600">Correção fixa (célula capacitiva) - % da potência dos transformadores</label>
                  <input type="range" min="0" max="10" step="1" value={correcaoFixaPercent} onChange={(e) => setCorrecaoFixaPercent(parseInt(e.target.value))} className="w-full" />
                  <div className="flex justify-between text-xs"><span>0%</span><span className="font-bold">{correcaoFixaPercent}%</span><span>10%</span></div>
                  <p className="text-[10px] text-slate-500">Recomendado 3-5% para compensar o reativo fixo do transformador.</p>
                </div>
                <div>
                  <label className="text-xs text-slate-600">Número de estágios automáticos (6 a 8)</label>
                  <input type="range" min="6" max="8" step="1" value={numeroEstagios} onChange={(e) => setNumeroEstagios(parseInt(e.target.value))} className="w-full" />
                  <div className="flex justify-between text-xs"><span>6</span><span className="font-bold">{numeroEstagios}</span><span>8</span></div>
                </div>
              </div>
            </details>
            <button onClick={calcularDimensionamento} disabled={calculando || faturas.length < 2} className="w-full bg-primary text-white py-3 rounded-xl font-bold disabled:opacity-50 flex justify-center gap-2">{calculando ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />} Calcular Dimensionamento</button>
          </div>
        </div>

        {/* Painel direito - resultados */}
        <div className="lg:col-span-7">
          {result ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div ref={reportRef} className="bg-white rounded-2xl overflow-hidden shadow-sm border">
                <div className="bg-slate-900 p-6 text-white text-center"><Zap size={32} className="mx-auto text-secondary mb-2" /><h2 className="text-2xl font-black">CapacitorManager</h2><p className="text-slate-400 text-sm">Memorial de Dimensionamento</p><p className="text-slate-500 text-xs">Gerado em {new Date().toLocaleDateString("pt-BR")}</p></div>
                <div className="p-6 space-y-6">
                  {result.precisa_capacitor ? (
                    <>
                      {/* Tabela resumo dos bancos */}
                      <div className="text-center border-b pb-4">
                        <p className="text-sm text-slate-500">Solução Proposta</p>
                        <p className="text-2xl font-bold text-primary">Banco fixo (célula capacitiva): {formatNumber(result.banco_fixo_kvar, 1)} kVAr</p>
                        <p className="text-2xl font-bold text-primary">Banco automático: {formatNumber(result.banco_automatico_kvar, 1)} kVAr ({result.estagios_automaticos.length} estágios)</p>
                        <p className="text-lg font-bold text-primary mt-2">Total: {formatNumber(result.banco_fixo_kvar + result.banco_automatico_kvar, 1)} kVAr</p>
                        <p className="text-xs text-slate-400">Grupo {result.grupo_tarifario} • {result.quantidade_faturas_analisadas} faturas • Método: {result.metodo_calculo_utilizado}</p>
                        <p className="text-xs text-slate-400">Fator de carga: {result.fator_carga_utilizado.toFixed(2)} • Correção fixa: {result.correcao_fixa_percent}%</p>
                      </div>

                      {result.alertas.length > 0 && result.alertas.map((a, i) => <div key={i} className="bg-amber-50 p-3 rounded-xl text-xs text-amber-700 flex gap-2"><AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />{a}</div>)}

                      <div className="bg-blue-50 p-4 rounded-xl"><p className="text-sm font-bold text-blue-700">📌 {result.motivo_recomendacao}</p><p className="text-xs mt-2">FP atual: {result.fp_atual_percent.toFixed(1)}% → Meta: {result.fp_projetado_percent.toFixed(0)}%</p><div className="mt-3"><BarraFP fp={result.fp_atual_percent} /><div className="flex justify-between text-[10px] mt-1"><span>Atual: {result.fp_atual_percent.toFixed(1)}%</span><span>Meta ANEEL: 92%</span></div></div></div>

                      <div className="grid grid-cols-2 gap-4"><div className="bg-red-50 p-4 text-center rounded-xl"><TrendingUp className="mx-auto text-red-600 mb-2" size={24} /><p className="text-xs font-medium">Multa Mensal Média</p><p className="text-2xl font-bold">{formatMoney(result.multa_atual_mensal_real)}</p><p className="text-xs text-red-500 mt-1">Calculada a partir do reativo excedente</p></div><div className="bg-green-50 p-4 text-center rounded-xl"><TrendingUp className="mx-auto text-green-600 mb-2" size={24} /><p className="text-xs font-medium">Economia Projetada</p><p className="text-2xl font-bold text-green-600">{formatMoney(result.economia_mensal_estimada)}/mês</p><p className="text-xs text-green-600 mt-1">Após correção do FP</p></div></div>

                      <div className="bg-slate-50 rounded-xl p-4"><p className="text-xs font-bold flex gap-2"><Activity size={14} /> Evolução do FP e Multa por Mês</p><div className="space-y-2 max-h-48 overflow-y-auto">{result.media_fp_por_mes.map((item, idx) => (<div key={idx} className="flex items-center gap-2 text-xs"><span className="w-14 font-medium">{item.mes}</span><div className="flex-1"><div className="w-full bg-slate-200 rounded-full h-1.5"><div className={`${item.fp >= 92 ? "bg-green-500" : item.fp >= 80 ? "bg-amber-500" : "bg-red-500"} h-1.5 rounded-full`} style={{ width: `${Math.min(100, item.fp)}%` }} /></div></div><span className="w-10 text-right font-bold">{item.fp.toFixed(1)}%</span><span className="w-20 text-right text-red-500 text-[10px]">{formatMoney(item.multa)}</span></div>))}</div></div>

                      {result.pior_mes && <div className="bg-amber-50 p-4 rounded-xl"><p className="text-xs font-bold">Pior Mês: {result.pior_mes.mes_referencia}</p><p className="text-sm mt-1">FP: {((result.pior_mes.fp_calculado || 0) * 100).toFixed(1)}% • Multa: {formatMoney(result.pior_mes.multa_calculada || 0)}</p></div>}

                      {/* Distribuição por transformador (apenas automático) */}
                      <div className="bg-indigo-50 p-4 rounded-xl"><p className="text-xs font-bold flex gap-2"><Factory size={14} /> Distribuição do Banco Automático entre Transformadores</p>{result.distribuicao_por_trafo.map((dist, idx) => (<div key={idx} className="bg-white rounded-lg p-3 mt-2 border"><div className="flex justify-between"><span className="font-bold text-sm">Transformador {formatNumber(dist.trafo_kva, 0)} kVA</span><span className="text-xs text-slate-500">{dist.percentual.toFixed(1)}% da carga</span></div><div className="grid grid-cols-2 gap-1 text-sm mt-2"><div>Recomendado: {formatNumber(dist.kvar_recomendado, 1)} kVAr</div><div>Comercial: {formatNumber(dist.kvar_comercial, 0)} kVAr</div><div className="col-span-2 text-xs text-slate-600">Configuração de estágios: {dist.configuracao_estagios}</div><div className="col-span-2 font-medium">Investimento (automático): {formatMoney(dist.preco_estimado)}</div></div></div>))}</div>

                      {/* Estágios do banco automático */}
                      <div><h3 className="font-bold mb-2 flex gap-2"><Layers size={18} /> Estágios do Banco Automático ({result.estagios_automaticos.length} estágios)</h3><div className="flex flex-wrap gap-2">{result.estagios_automaticos.map((s, i) => (<div key={i} className="bg-slate-100 rounded-lg px-3 py-1 border flex items-center gap-1"><span className="font-bold text-sm">{s.toFixed(1)}</span><span className="text-xs text-slate-500">kVAr</span></div>))}</div></div>

                      <div className="bg-emerald-50 p-4 rounded-xl"><p className="text-xs font-bold flex gap-2"><DollarSign size={14} /> Análise Financeira Real</p><div className="grid grid-cols-2 gap-2 text-center mt-2"><div className="bg-white rounded p-2 border"><p className="text-[10px] text-slate-500">Investimento Total</p><p className="font-bold text-lg">{formatMoney(result.investimento_estimado_total)}</p><p className="text-[10px] text-slate-500">(Fixo + Automático)</p></div><div className="bg-white rounded p-2 border"><p className="text-[10px] text-slate-500">Custo por kVAr (automático)</p><p className="font-bold">{formatMoney(result.preco_por_kvar)}/kVAr</p></div></div><div className="grid grid-cols-3 gap-2 text-center mt-2"><div className="bg-white rounded p-2 border"><p className="text-[10px] text-slate-500">Payback</p><p className="font-bold text-green-600">{result.payback_meses} meses</p></div><div className="bg-white rounded p-2 border"><p className="text-[10px] text-slate-500">Economia/ano</p><p className="font-bold">{formatMoney(result.economia_anual)}</p></div><div className="bg-white rounded p-2 border"><p className="text-[10px] text-slate-500">Retorno 5 anos</p><p className={`font-bold ${result.retorno_5_anos > 0 ? "text-green-700" : "text-red-700"}`}>{formatMoney(result.retorno_5_anos)}</p></div></div></div>

                      {/* Blocos comerciais para proposta */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                          <p className="text-xs font-bold text-red-700">a) Prejuízo acumulado</p>
                          <p className="text-xl font-black text-red-700 mt-1">{formatMoney(result.prejuizo_acumulado)}</p>
                          <p className="text-[10px] text-red-600 mt-1">Soma das multas das faturas analisadas.</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                          <p className="text-xs font-bold text-blue-700">b) Projeção de economia</p>
                          <div className="text-[11px] mt-2 space-y-1">
                            <p><strong>1 ano:</strong> {formatMoney(result.projecao_1_ano)}</p>
                            <p><strong>3 anos:</strong> {formatMoney(result.projecao_3_anos)}</p>
                            <p><strong>5 anos:</strong> {formatMoney(result.projecao_5_anos)}</p>
                          </div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                          <p className="text-xs font-bold text-green-700">c) ROI em 5 anos</p>
                          <p className={`text-xl font-black mt-1 ${result.roi_5_anos_percent >= 0 ? "text-green-700" : "text-red-700"}`}>{formatNumber(result.roi_5_anos_percent, 1)}%</p>
                          <p className="text-[10px] text-green-700 mt-1">Indicador de viabilidade financeira do projeto.</p>
                        </div>
                      </div>

                      <div className="bg-white border rounded-xl p-4">
                        <p className="text-xs font-bold">Resumo executivo (proposta comercial)</p>
                        <p className="text-sm mt-2 text-slate-700">
                          Com base no diagnóstico do fator de potência e no histórico de multas, recomenda-se a implantação de banco de capacitores
                          fixo + automático para mitigar perdas financeiras recorrentes. A solução projeta redução relevante das penalidades por energia
                          reativa, com retorno estimado em <strong>{result.payback_meses} meses</strong> e ROI de <strong>{formatNumber(result.roi_5_anos_percent, 1)}%</strong> em 5 anos.
                        </p>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl"><h4 className="font-bold text-sm mb-2">Especificações Técnicas</h4><div className="grid grid-cols-2 gap-2 text-xs"><div>• Tensão: {result.tensao_capacitores} (Δ)</div><div>• Reatores: {result.fator_dessintonia}%</div><div>• Controlador: Automático</div><div>• Grau IP: Mínimo IP54</div><div className="col-span-2 text-[10px] text-slate-500 mt-1">• Compatível com rede 380V trifásica • Conformidade NBR 14922/2022</div></div></div>
                    </>
                  ) : (<div className="text-center py-8"><CheckCircle2 size={40} className="mx-auto text-green-600 mb-2" /><p className="text-xl font-bold text-green-700">Instalação Regularizada</p><p className="text-sm mt-2">{result.motivo_recomendacao}</p></div>)}
                  <div className="text-center text-[10px] text-slate-400 border-t pt-4"><p>Cálculos baseados em ANEEL, NBR 14922/2022 e dados reais de fatura</p></div>
                </div>
              </div>
              <button onClick={exportMemorial} className="w-full bg-white border py-3 rounded-xl font-medium flex justify-center gap-2 hover:bg-slate-50 transition"><Printer size={18} /> Exportar Memorial em PDF</button>
            </motion.div>
          ) : (
            <div className="h-[500px] flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed"><Calculator size={64} className="text-slate-300 mb-4" /><h3 className="text-xl font-bold">Aguardando Dados</h3><p className="text-sm text-slate-400 mt-2">Configure transformadores e adicione faturas da Equatorial Pará ou Roraima</p><button onClick={carregarFaturaExemploReal} className="mt-4 text-primary text-sm font-medium hover:underline">Carregar dados reais da WG ARMAZENS GERAIS →</button></div>
          )}
        </div>
      </div>

      {/* Modal de fatura */}
      <AnimatePresence>
        {showFaturaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">{editandoFaturaId ? "✏️ Editar" : "➕ Nova Fatura"}</h3><button onClick={() => setShowFaturaModal(false)}><X size={20} /></button></div>
              <div className="space-y-3">
                <div><label className="text-sm font-medium">Mês/Ano *</label><input type="text" placeholder="Ex: 11/2025" value={currentFatura.mes_referencia || ""} onChange={(e) => setCurrentFatura({ ...currentFatura, mes_referencia: e.target.value })} className="w-full border rounded p-2 mt-1" /></div>
                <div><label className="text-sm font-medium">Concessionária</label><select value={currentFatura.concessionaria || "EQUATORIAL_PARA"} onChange={(e) => setCurrentFatura({ ...currentFatura, concessionaria: e.target.value })} className="w-full border rounded p-2 mt-1"><option value="EQUATORIAL_PARA">Equatorial Pará</option><option value="RORAIMA_ENERGIA">Roraima Energia</option></select></div>
                <div className="grid grid-cols-2 gap-2"><div><label className="text-xs">Consumo Ponta (kWh)</label><input type="text" placeholder="Ex: 457,21" value={currentFatura.consumo_ponta_kwh !== undefined ? formatNumber(currentFatura.consumo_ponta_kwh as number, 2) : ""} onChange={(e) => setCurrentFatura({ ...currentFatura, consumo_ponta_kwh: parseBRLocal(e.target.value) })} className="w-full border rounded p-2 text-sm mt-1" /></div><div><label className="text-xs">Consumo F/Ponta (kWh)</label><input type="text" placeholder="Ex: 5179,86" value={currentFatura.consumo_fora_ponta_kwh !== undefined ? formatNumber(currentFatura.consumo_fora_ponta_kwh as number, 2) : ""} onChange={(e) => setCurrentFatura({ ...currentFatura, consumo_fora_ponta_kwh: parseBRLocal(e.target.value) })} className="w-full border rounded p-2 text-sm mt-1" /></div></div>
                <div className="grid grid-cols-2 gap-2"><div><label className="text-xs">Demanda Ponta (kW)</label><input type="text" placeholder="Ex: 53,42" value={currentFatura.demanda_ponta_kw !== undefined ? formatNumber(currentFatura.demanda_ponta_kw as number, 2) : ""} onChange={(e) => setCurrentFatura({ ...currentFatura, demanda_ponta_kw: parseBRLocal(e.target.value) })} className="w-full border rounded p-2 text-sm mt-1" /></div><div><label className="text-xs">Demanda F/Ponta (kW)</label><input type="text" placeholder="Ex: 53,42" value={currentFatura.demanda_fora_ponta_kw !== undefined ? formatNumber(currentFatura.demanda_fora_ponta_kw as number, 2) : ""} onChange={(e) => setCurrentFatura({ ...currentFatura, demanda_fora_ponta_kw: parseBRLocal(e.target.value) })} className="w-full border rounded p-2 text-sm mt-1" /></div></div>
                <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-medium text-red-600">Reativo Ponta (kVArh) *</label><input type="text" placeholder="Ex: 493,76" value={currentFatura.reativo_ponta_kvarh !== undefined ? formatNumber(currentFatura.reativo_ponta_kvarh as number, 2) : ""} onChange={(e) => setCurrentFatura({ ...currentFatura, reativo_ponta_kvarh: parseBRLocal(e.target.value) })} className="w-full border rounded p-2 text-sm mt-1 border-red-200" /></div><div><label className="text-xs font-medium text-red-600">Reativo F/Ponta (kVArh) *</label><input type="text" placeholder="Ex: 4696,54" value={currentFatura.reativo_fora_ponta_kvarh !== undefined ? formatNumber(currentFatura.reativo_fora_ponta_kvarh as number, 2) : ""} onChange={(e) => setCurrentFatura({ ...currentFatura, reativo_fora_ponta_kvarh: parseBRLocal(e.target.value) })} className="w-full border rounded p-2 text-sm mt-1 border-red-200" /></div></div>
                <div className="grid grid-cols-2 gap-2"><div><label className="text-xs">Dias do ciclo</label><input type="text" placeholder="30" value={currentFatura.dias_ciclo !== undefined ? formatNumber(currentFatura.dias_ciclo as number, 0) : "30"} onChange={(e) => setCurrentFatura({ ...currentFatura, dias_ciclo: parseBRLocal(e.target.value) })} className="w-full border rounded p-2 text-sm mt-1" /></div><div><label className="text-xs">Total a Pagar (R$)</label><input type="text" placeholder="Ex: 12617,50" value={currentFatura.total_pagar !== undefined ? formatMoney(currentFatura.total_pagar as number) : ""} onChange={(e) => setCurrentFatura({ ...currentFatura, total_pagar: parseBRLocal(e.target.value) })} className="w-full border rounded p-2 text-sm mt-1" /></div></div>
                <div><label className="text-xs text-slate-500">Multa informada (opcional, substitui a calculada)</label><input type="text" placeholder="Ex: 1961,05" value={currentFatura.multa_informada !== undefined ? formatMoney(currentFatura.multa_informada as number) : ""} onChange={(e) => setCurrentFatura({ ...currentFatura, multa_informada: parseBRLocal(e.target.value) })} className="w-full border rounded p-2 text-sm mt-1" /></div>
              </div>
              <div className="flex gap-3 mt-6"><button onClick={() => setCurrentFatura({ mes_referencia: "05/2025", consumo_ponta_kwh: 8132, consumo_fora_ponta_kwh: 59050, demanda_ponta_kw: 430, demanda_fora_ponta_kw: 447, reativo_ponta_kvarh: 824, reativo_fora_ponta_kvarh: 4511, total_pagar: 55970.04, dias_ciclo: 30, concessionaria: "RORAIMA_ENERGIA" })} className="flex-1 py-2 border rounded-lg text-sm hover:bg-slate-50">Exemplo Roraima</button><button onClick={salvarFatura} className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium">Salvar Fatura</button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
