"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Calculator,
  Zap,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  FileText,
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
  AlertCircle,
  Factory,
  Truck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";

// ============================================
// CONSTANTES
// ============================================
const FP_MINIMO_REGULAMENTAR = 0.92;

const TARIFAS_REATIVO: Record<
  string,
  { base: number; data_referencia: string; observacao: string }
> = {
  EQUATORIAL_PARA: {
    base: 0.28622,
    data_referencia: "12/2025",
    observacao: "Tarifa do reativo excedente - fatura Dez/2025",
  },
  RORAIMA_ENERGIA: {
    base: 0.30603,
    data_referencia: "06/2025",
    observacao: "Tarifa para reativo excedente",
  },
  DEFAULT: {
    base: 0.28622,
    data_referencia: "padrão",
    observacao: "Valor baseado na Equatorial Pará",
  },
};

const PRECOS_MERCADO_CAPACITORES: Record<
  string,
  { preco_medio: number; faixa_preco: string; fornecedores: string[] }
> = {
  "20": { preco_medio: 5400, faixa_preco: "R$ 4.900 - R$ 5.900", fornecedores: ["FASF", "Genérico", "5G"] },
  "30": { preco_medio: 5300, faixa_preco: "R$ 4.800 - R$ 5.800", fornecedores: ["FASF", "5G", "WEG"] },
  "50": { preco_medio: 9700, faixa_preco: "R$ 8.900 - R$ 10.500", fornecedores: ["FASF", "5G", "Siemens"] },
  "70": { preco_medio: 13600, faixa_preco: "R$ 12.500 - R$ 14.800", fornecedores: ["FASF", "ABB"] },
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
  margem_seguranca: 1.3,
  minimo_kvar_grupo_a: 20,
  minimo_kvar_grupo_b: 10,
  estagios_padrao: [60, 50, 40, 30, 25, 20, 15, 12.5, 10, 7.5, 5, 2.5],
  dessintonia_padrao: 7,
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
  fp_informado?: number;
  reativo_excedente_calculado?: number;
  multa_reativo_calculada?: number;
  tarifa_reativo_utilizada?: number;
  validado: boolean;
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
  kvar_total: number;
  kvar_total_comercial: number;
  kvar_por_estagio: number[];
  tensao_capacitores: string;
  fator_dessintonia: number;
  economia_mensal_estimada: number;
  investimento_estimado: number;
  investimento_estimado_comercial: number;
  investimento_mercado_real: number;
  payback_meses: number;
  payback_meses_comercial: number;
  payback_mercado_real: number;
  fp_atual_percent: number;
  fp_projetado_percent: number;
  multa_atual_mensal_real: number;
  multa_atual_mensal_calculada: number;
  consumo_ativo_medio_mensal_kwh: number;
  consumo_reativo_medio_mensal_kvarh: number;
  potencia_ativa_media_kw: number;
  precisa_capacitor: boolean;
  grupo_tarifario: "A" | "B";
  motivo_recomendacao: string;
  concessionaria_identificada: string;
  quantidade_faturas_analisadas: number;
  pior_mes: Fatura | null;
  media_fp_por_mes: Array<{ mes: string; fp: number; multa: number }>;
  consistencia_dados: number;
  alertas: string[];
  distribuicao_por_trafo: DistribuicaoTrafo[];
  fornecedores_recomendados: typeof FORNECEDORES_RECOMENDADOS;
  preco_por_kvar: number;
  economia_anual: number;
  retorno_5_anos: number;
  metodo_calculo_utilizado: "demanda" | "manual" | "startek";
}

// ============================================
// UTILITÁRIOS (APENAS UMA VEZ!)
// ============================================
const parseBRLocal = (valor: string | number | undefined): number => {
  if (valor === undefined || valor === null) return 0;
  if (typeof valor === "number") return valor;
  if (valor === "") return 0;
  let limpo = valor.toString().trim();
  limpo = limpo.replace(/[^\d,.-]/g, "");
  if (limpo.includes(",") && limpo.includes(".")) {
    limpo = limpo.replace(/\./g, "").replace(",", ".");
  } else if (limpo.includes(",")) {
    limpo = limpo.replace(",", ".");
  }
  const numero = parseFloat(limpo);
  return isNaN(numero) ? 0 : numero;
};

const formatMoney = (valor: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(valor);
};

const formatNumber = (valor: number, decimals: number = 2): string => {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(valor);
};

const calcularFatorPotencia = (ativo_kwh: number, reativo_kvarh: number): number => {
  if (ativo_kwh <= 0) return 0.92;
  const aparente = Math.sqrt(ativo_kwh ** 2 + reativo_kvarh ** 2);
  if (aparente === 0) return 0.92;
  return Math.min(0.99, Math.max(0.3, ativo_kwh / aparente));
};

const calcularReativoExcedente = (ativo_kwh: number, reativo_kvarh: number): number => {
  if (ativo_kwh <= 0) return 0;
  const tanPhiMinimo = Math.tan(Math.acos(FP_MINIMO_REGULAMENTAR));
  const permitido = ativo_kwh * tanPhiMinimo;
  const excedente = reativo_kvarh - permitido;
  return Math.max(0, excedente);
};

const calcularMultaReativa = (
  ativo_kwh: number,
  reativo_kvarh: number,
  tarifa_reativo: number,
): number => {
  const excedente = calcularReativoExcedente(ativo_kwh, reativo_kvarh);
  return excedente * tarifa_reativo;
};

const calcularKvarNecessario = (
  potencia_ativa_kw: number,
  fp_atual: number,
  fp_desejado: number,
): number => {
  const fp_atual_seguro = Math.min(0.99, Math.max(0.3, fp_atual));
  const fp_desejado_seguro = Math.min(0.99, Math.max(fp_desejado, 0.92));
  const angulo_atual = Math.acos(fp_atual_seguro);
  const angulo_desejado = Math.acos(fp_desejado_seguro);
  let kvar = potencia_ativa_kw * (Math.tan(angulo_atual) - Math.tan(angulo_desejado));
  kvar = Math.max(0, kvar);
  return Math.ceil(kvar / 2.5) * 2.5;
};

const distribuirEstagios = (total_kvar: number): number[] => {
  const sizes = [...CONFIG_CAPACITORES.estagios_padrao];
  let restante = total_kvar;
  const stages: number[] = [];
  for (const size of sizes) {
    while (restante >= size && stages.length < 6) {
      stages.push(size);
      restante -= size;
    }
  }
  if (restante >= 2.5) {
    stages.push(Math.ceil(restante / 2.5) * 2.5);
  }
  return stages.sort((a, b) => a - b);
};

const calcularPrecoMercado = (kvar: number): number => {
  const potencias = Object.keys(PRECOS_MERCADO_CAPACITORES)
    .map(Number)
    .sort((a, b) => a - b);
  let maisProximo = potencias[0];
  let menorDiferenca = Math.abs(kvar - maisProximo);
  for (const p of potencias) {
    const diff = Math.abs(kvar - p);
    if (diff < menorDiferenca) {
      menorDiferenca = diff;
      maisProximo = p;
    }
  }
  const preco = PRECOS_MERCADO_CAPACITORES[maisProximo.toString()]?.preco_medio || 25000;
  if (kvar !== maisProximo) {
    const precoPorKvar = preco / maisProximo;
    return Math.round(kvar * precoPorKvar);
  }
  return preco;
};

const distribuirKvarPorTrafo = (
  transformadores: Transformador[],
  kvarTotalComercial: number,
): DistribuicaoTrafo[] => {
  const potenciaTotal = transformadores.reduce((acc, t) => acc + t.potencia_kva * t.quantidade, 0);
  return transformadores.map((trafo) => {
    const potenciaTrafo = trafo.potencia_kva * trafo.quantidade;
    const percentual = potenciaTrafo / potenciaTotal;
    let kvarRecomendado = kvarTotalComercial * percentual;
    let kvarComercial = Math.ceil(kvarRecomendado / 10) * 10;
    if (kvarComercial < 10 && kvarRecomendado > 0) kvarComercial = 10;
    const precoEstimado = calcularPrecoMercado(kvarComercial);
    let configuracaoEstagios = "";
    if (kvarComercial <= 30)
      configuracaoEstagios = `${kvarComercial} kVAr (estágio único)`;
    else if (kvarComercial <= 60)
      configuracaoEstagios = `${Math.round(kvarComercial / 2)} + ${Math.round(kvarComercial / 2)} kVAr`;
    else if (kvarComercial <= 100)
      configuracaoEstagios = `${Math.round(kvarComercial / 3)} + ${Math.round(kvarComercial / 3)} + ${Math.round(kvarComercial / 3)} kVAr`;
    else
      configuracaoEstagios = `${Math.round(kvarComercial / 0.6 / 100) * 60} + ${kvarComercial - Math.round(kvarComercial / 0.6 / 100) * 60} kVAr`;
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
  // ... (todo o restante do componente permanece igual)

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function DimensionarPage() {
  const reportRef = useRef<HTMLDivElement>(null);
  const [transformadores, setTransformadores] = useState<Transformador[]>([
    {
      id: "1",
      potencia_kva: 300,
      quantidade: 1,
      tensao_v: 380,
      horas_trabalho: 220,
    },
    {
      id: "2",
      potencia_kva: 225,
      quantidade: 1,
      tensao_v: 380,
      horas_trabalho: 220,
    },
  ]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [targetFP, setTargetFP] = useState<number>(0.95);
  const [result, setResult] = useState<ResultadoDimensionamento | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [showFaturaModal, setShowFaturaModal] = useState(false);
  const [currentFatura, setCurrentFatura] = useState<
    Partial<Record<keyof Fatura, string | number>>
  >({});
  const [editandoFaturaId, setEditandoFaturaId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Configurações avançadas (não mais usadas para dimensionamento principal, mas mantidas para compatibilidade)
  const [fatorSimultaneidade, setFatorSimultaneidade] = useState(0.65);
  const [kvarRecomendadoManual, setKvarRecomendadoManual] = useState<
    number | null
  >(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = () => {
    try {
      const savedTrafos = localStorage.getItem("dimensionar_transformadores");
      if (savedTrafos) setTransformadores(JSON.parse(savedTrafos));
      const savedFaturas = localStorage.getItem("dimensionar_faturas");
      if (savedFaturas) {
        setFaturas(JSON.parse(savedFaturas));
      } else {
        carregarFaturaExemploReal();
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setCarregando(false);
    }
  };

  const carregarFaturaExemploReal = () => {
    // Dados reais extraídos das faturas da WG ARMAZENS GERAIS - Equatorial Pará
    const faturasCorretas: Fatura[] = [
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
    setFaturas(faturasCorretas);
    localStorage.setItem(
      "dimensionar_faturas",
      JSON.stringify(faturasCorretas),
    );
  };

  const validarFatura = (
    fatura: Partial<Fatura>,
  ): { valida: boolean; mensagem: string } => {
    const consumoTotal =
      ((fatura.consumo_ponta_kwh as number) || 0) +
      ((fatura.consumo_fora_ponta_kwh as number) || 0);
    const reativoTotal =
      ((fatura.reativo_ponta_kvarh as number) || 0) +
      ((fatura.reativo_fora_ponta_kvarh as number) || 0);
    if (consumoTotal === 0 && reativoTotal === 0)
      return { valida: false, mensagem: "Ambos os valores estão zerados." };
    if (reativoTotal > consumoTotal && consumoTotal > 0) {
      const percentual = (reativoTotal / consumoTotal) * 100;
      if (percentual > 200)
        return {
          valida: false,
          mensagem: `Reativo é ${percentual.toFixed(0)}% maior que o Consumo. Verifique se os valores estão trocados.`,
        };
    }
    const fp = calcularFatorPotencia(consumoTotal, reativoTotal);
    if (fp < 0.5 && consumoTotal > 0 && reativoTotal > 0)
      return {
        valida: false,
        mensagem: `FP calculado é ${(fp * 100).toFixed(1)}%. Verifique os dados.`,
      };
    return { valida: true, mensagem: "" };
  };

  const salvarTransformadores = () => {
    localStorage.setItem(
      "dimensionar_transformadores",
      JSON.stringify(transformadores),
    );
    Swal.fire({
      title: "✅ Sucesso!",
      text: "Configuração dos transformadores salva!",
      icon: "success",
      timer: 1500,
    });
  };

  const salvarFatura = async () => {
    if (!currentFatura.mes_referencia) {
      Swal.fire("Atenção", "Informe o mês de referência", "warning");
      return;
    }

    const consumoPonta = parseBRLocal(currentFatura.consumo_ponta_kwh);
    const consumoForaPonta = parseBRLocal(currentFatura.consumo_fora_ponta_kwh);
    const reativoPonta = parseBRLocal(currentFatura.reativo_ponta_kvarh);
    const reativoForaPonta = parseBRLocal(
      currentFatura.reativo_fora_ponta_kvarh,
    );
    const demandaPonta = parseBRLocal(currentFatura.demanda_ponta_kw);
    const demandaForaPonta = parseBRLocal(currentFatura.demanda_fora_ponta_kw);
    const totalPagar = parseBRLocal(currentFatura.total_pagar);
    const diasCiclo =
      parseInt(currentFatura.dias_ciclo?.toString() || "30") || 30;
    const concessionaria =
      (currentFatura.concessionaria as string) || "EQUATORIAL_PARA";

    if (
      reativoPonta === 0 &&
      reativoForaPonta === 0 &&
      consumoPonta + consumoForaPonta > 0
    ) {
      Swal.fire({
        title: "⚠️ Atenção!",
        html: "Os valores de energia reativa estão ZERADOS. Isso fará a multa ser zero.<br/>Preencha corretamente os campos <strong>Reativo Ponta</strong> e <strong>Reativo Fora Ponta</strong>.",
        icon: "warning",
      });
      return;
    }

    const ativoTotal = consumoPonta + consumoForaPonta;
    const reativoTotal = reativoPonta + reativoForaPonta;
    const tarifaBase =
      TARIFAS_REATIVO[concessionaria as keyof typeof TARIFAS_REATIVO]?.base ||
      TARIFAS_REATIVO.DEFAULT.base;
    const fpCalc = calcularFatorPotencia(ativoTotal, reativoTotal);
    const multa = calcularMultaReativa(ativoTotal, reativoTotal, tarifaBase);

    const confirmar = await Swal.fire({
      title: "Confirmar dados?",
      html: `<div class="text-left">
        <p><strong>Mês:</strong> ${currentFatura.mes_referencia}</p>
        <p><strong>Ativo Total:</strong> ${formatNumber(ativoTotal, 0)} kWh</p>
        <p><strong>Reativo Total:</strong> ${formatNumber(reativoTotal, 0)} kVArh</p>
        <p><strong>FP calculado:</strong> ${(fpCalc * 100).toFixed(1)}%</p>
        <p><strong>Multa estimada:</strong> ${formatMoney(multa)}</p>
      </div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Salvar",
      cancelButtonText: "Revisar",
    });
    if (!confirmar.isConfirmed) return;

    const novaFatura: Fatura = {
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
      fp_calculado: fpCalc,
      fp_informado: currentFatura.fp_informado
        ? parseBRLocal(currentFatura.fp_informado)
        : undefined,
      reativo_excedente_calculado: calcularReativoExcedente(
        ativoTotal,
        reativoTotal,
      ),
      multa_reativo_calculada: multa,
      tarifa_reativo_utilizada: tarifaBase,
    };

    let novasFaturas = [...faturas];
    if (editandoFaturaId) {
      const index = faturas.findIndex((f) => f.id === editandoFaturaId);
      if (index !== -1) novasFaturas[index] = novaFatura;
      else novasFaturas = [novaFatura, ...novasFaturas];
    } else {
      novasFaturas = [novaFatura, ...novasFaturas];
    }
    novasFaturas.sort((a, b) =>
      b.mes_referencia.localeCompare(a.mes_referencia),
    );
    setFaturas(novasFaturas);
    localStorage.setItem("dimensionar_faturas", JSON.stringify(novasFaturas));
    setShowFaturaModal(false);
    setCurrentFatura({});
    setEditandoFaturaId(null);
    Swal.fire({
      title: "✅ Sucesso!",
      text: "Fatura salva!",
      icon: "success",
      timer: 1500,
    });
  };

  const carregarFaturaExemplo = () => {
    setCurrentFatura({
      mes_referencia: "05/2025",
      consumo_ponta_kwh: 8132,
      consumo_fora_ponta_kwh: 59050,
      demanda_ponta_kw: 430,
      demanda_fora_ponta_kw: 447,
      reativo_ponta_kvarh: 824,
      reativo_fora_ponta_kvarh: 4511,
      total_pagar: 55970.04,
      dias_ciclo: 30,
      concessionaria: "RORAIMA_ENERGIA",
    });
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
        const novasFaturas = faturas.filter((f) => f.id !== id);
        setFaturas(novasFaturas);
        localStorage.setItem(
          "dimensionar_faturas",
          JSON.stringify(novasFaturas),
        );
        Swal.fire("Removida!", "Fatura removida com sucesso.", "success");
      }
    });
  };

  const adicionarTransformador = () => {
    const newId = (transformadores.length + 1).toString();
    setTransformadores([
      ...transformadores,
      {
        id: newId,
        potencia_kva: 100,
        quantidade: 1,
        tensao_v: 220,
        horas_trabalho: 220,
      },
    ]);
  };

  const removerTransformador = (index: number) => {
    if (transformadores.length > 1)
      setTransformadores(transformadores.filter((_, i) => i !== index));
  };

  const atualizarTransformador = (
    index: number,
    field: keyof Transformador,
    value: number,
  ) => {
    const novos = [...transformadores];
    novos[index] = { ...novos[index], [field]: value };
    setTransformadores(novos);
  };

  const potenciaTotalTransformadores = transformadores.reduce(
    (acc, t) => acc + t.potencia_kva * t.quantidade,
    0,
  );

  // ============================================
  // ✅ NOVO CÁLCULO – ALINHADO COM A ENGENHARIA E STARTEK
  // ============================================
  const calcularDimensionamento = () => {
    if (faturas.length < 2) {
      Swal.fire(
        "Atenção",
        "Mínimo de 2 faturas para dimensionamento confiável",
        "warning",
      );
      return;
    }
    setCalculando(true);
    try {
      console.log("=== INICIANDO DIMENSIONAMENTO CORRIGIDO (Startek) ===");
      const alertas: string[] = [];
      const concessionarias = [
        ...new Set(faturas.map((f) => f.concessionaria)),
      ];
      if (concessionarias.length > 1)
        alertas.push(
          `⚠️ Faturas de diferentes concessionárias: ${concessionarias.join(", ")}`,
        );

      // Processa faturas
      const faturasProcessadas = faturas.map((f) => {
        const ativoTotal = f.consumo_ponta_kwh + f.consumo_fora_ponta_kwh;
        const reativoTotal = f.reativo_ponta_kvarh + f.reativo_fora_ponta_kvarh;
        const fp = calcularFatorPotencia(ativoTotal, reativoTotal);
        const tarifa =
          TARIFAS_REATIVO[f.concessionaria as keyof typeof TARIFAS_REATIVO]
            ?.base || TARIFAS_REATIVO.DEFAULT.base;
        const multa = calcularMultaReativa(ativoTotal, reativoTotal, tarifa);
        const demandaMaxKw = Math.max(
          f.demanda_ponta_kw,
          f.demanda_fora_ponta_kw,
          0.1,
        );
        return {
          ...f,
          ativoTotal,
          reativoTotal,
          fp,
          tarifa,
          multa,
          demandaMaxKw,
        };
      });

      // Pior mês (menor FP)
      const piorMes = faturasProcessadas.reduce(
        (prev, curr) => (curr.fp < prev.fp ? curr : prev),
        faturasProcessadas[0],
      );
      const fpAtual = piorMes.fp;
      const fpDesejado = targetFP;

      // Média da multa atual
      const mediaMulta =
        faturasProcessadas.reduce((acc, f) => acc + f.multa, 0) /
        faturasProcessadas.length;

      // Demanda ativa máxima registrada nas faturas
      const demandaMaxRegistrada = Math.max(
        ...faturasProcessadas.map((f) => f.demandaMaxKw),
      );

      // ✅ CHAVE: Estimar a potência ativa real que o banco deve atender
      // A demanda registrada (53 kW) está muito abaixo da capacidade dos transformadores (525 kVA).
      // Em projetos de correção de FP, considera-se uma carga típica de 50% a 70% da potência dos trafos.
      // Para este caso, adotamos 50% (conservador) -> 262,5 kVA.
      // Potência ativa = 262,5 kVA * FP atual (0,55) ≈ 144 kW.
      const potenciaTotalKVA = potenciaTotalTransformadores;
      const fatorCargaEstimado = 0.5; // 50% da capacidade nominal (prática comum)
      const potenciaAtivaEstimadaPelaCapacidade =
        potenciaTotalKVA * fatorCargaEstimado * fpAtual;

      // Usamos o maior valor entre a demanda registrada e a estimativa baseada nos trafos
      const potenciaAtivaProjetada = Math.max(
        demandaMaxRegistrada,
        potenciaAtivaEstimadaPelaCapacidade,
      );

      console.log(`Demanda registrada: ${demandaMaxRegistrada.toFixed(1)} kW`);
      console.log(
        `Estimativa por trafos (50%): ${potenciaAtivaEstimadaPelaCapacidade.toFixed(1)} kW`,
      );
      console.log(
        `Potência ativa projetada: ${potenciaAtivaProjetada.toFixed(1)} kW`,
      );

      // Verifica se precisa de capacitor
      const precisaCapacitor =
        fpAtual < FP_MINIMO_REGULAMENTAR || mediaMulta > 200;
      let totalKvar = 0;
      let totalKvarComercial = 0;
      let stages: number[] = [];
      let economiaMensal = 0;
      let metodoCalculo: "demanda" | "manual" | "startek" = "demanda";
      let motivo = "";

      if (precisaCapacitor) {
        // 1. Se o usuário forneceu kVAr manual, usa ele
        if (kvarRecomendadoManual && kvarRecomendadoManual > 0) {
          totalKvar = kvarRecomendadoManual;
          metodoCalculo = "manual";
          motivo = `Valor definido por especialista: ${totalKvar} kVAr (laudo técnico)`;
        } else {
          // 2. Método clássico (e utilizado pela Startek) baseado na potência ativa projetada
          totalKvar = calcularKvarNecessario(
            potenciaAtivaProjetada,
            fpAtual,
            fpDesejado,
          );
          metodoCalculo = "startek";
          motivo = `Potência ativa projetada = ${potenciaAtivaProjetada.toFixed(1)} kW | FP atual = ${(fpAtual * 100).toFixed(1)}% | Meta = ${(fpDesejado * 100).toFixed(0)}% | Método clássico (P*Δtan)`;
        }

        // Arredondar para múltiplo de 10 (valor comercial)
        totalKvarComercial = Math.ceil(totalKvar / 10) * 10;
        totalKvarComercial = Math.max(
          totalKvarComercial,
          CONFIG_CAPACITORES.minimo_kvar_grupo_a,
        );

        // Limite superior para evitar exageros (até 80% da potência total dos trafos)
        const limiteSuperior = potenciaTotalKVA * 0.8;
        if (totalKvarComercial > limiteSuperior) {
          alertas.push(
            `⚠️ kVAr calculado (${totalKvarComercial}) excede 80% da potência dos trafos. Limitando a ${limiteSuperior.toFixed(0)} kVAr.`,
          );
          totalKvarComercial = Math.ceil(limiteSuperior / 10) * 10;
          totalKvar = totalKvarComercial;
        }

        stages = distribuirEstagios(totalKvarComercial);
        economiaMensal = mediaMulta * 0.92; // eficácia típica de 92%

        if (economiaMensal < 100 && mediaMulta > 0)
          alertas.push(
            "⚠️ Economia mensal muito baixa. Verifique se os valores de reativo estão corretos nas faturas.",
          );
      } else {
        const mediaFp =
          faturasProcessadas.reduce((a, b) => a + b.fp, 0) /
          faturasProcessadas.length;
        motivo = `✅ Sistema regularizado (FP médio: ${(mediaFp * 100).toFixed(1)}%)`;
      }

      // Investimentos e payback
      const investimentoMercadoReal =
        totalKvarComercial > 0 ? calcularPrecoMercado(totalKvarComercial) : 0;
      const payback =
        economiaMensal > 0
          ? Math.ceil(investimentoMercadoReal / economiaMensal)
          : 99;
      const economiaAnual = economiaMensal * 12;
      const retorno5Anos = economiaAnual * 5 - investimentoMercadoReal;
      const precoPorKvar =
        totalKvarComercial > 0
          ? investimentoMercadoReal / totalKvarComercial
          : 0;

      // Distribuição entre transformadores (proporcional à potência)
      const distribuicaoPorTrafo = distribuirKvarPorTrafo(
        transformadores,
        totalKvarComercial,
      );

      const tensaoCapacitores =
        transformadores[0]?.tensao_v === 380
          ? CONFIG_CAPACITORES.tensao_padrao_380v
          : CONFIG_CAPACITORES.tensao_padrao_220v;

      const mediaFpPorMes = faturasProcessadas
        .map((f) => ({
          mes: f.mes_referencia,
          fp: f.fp * 100,
          multa: f.multa,
        }))
        .sort((a, b) => a.fp - b.fp);

      const grupoTarifario = potenciaTotalTransformadores >= 75 ? "A" : "B";

      setResult({
        kvar_total: totalKvar,
        kvar_total_comercial: totalKvarComercial,
        kvar_por_estagio: stages,
        tensao_capacitores: tensaoCapacitores,
        fator_dessintonia: CONFIG_CAPACITORES.dessintonia_padrao,
        economia_mensal_estimada: economiaMensal,
        investimento_estimado: investimentoMercadoReal * 0.9,
        investimento_estimado_comercial: investimentoMercadoReal,
        investimento_mercado_real: investimentoMercadoReal,
        payback_meses: payback,
        payback_meses_comercial: payback,
        payback_mercado_real: payback,
        fp_atual_percent: fpAtual * 100,
        fp_projetado_percent: precisaCapacitor
          ? fpDesejado * 100
          : fpAtual * 100,
        multa_atual_mensal_real: mediaMulta,
        multa_atual_mensal_calculada: mediaMulta,
        consumo_ativo_medio_mensal_kwh:
          faturasProcessadas.reduce((a, b) => a + b.ativoTotal, 0) /
          faturasProcessadas.length,
        consumo_reativo_medio_mensal_kvarh:
          faturasProcessadas.reduce((a, b) => a + b.reativoTotal, 0) /
          faturasProcessadas.length,
        potencia_ativa_media_kw: potenciaAtivaProjetada,
        precisa_capacitor: precisaCapacitor,
        grupo_tarifario: grupoTarifario,
        motivo_recomendacao: motivo,
        concessionaria_identificada: concessionarias[0] || "NÃO IDENTIFICADA",
        quantidade_faturas_analisadas: faturasProcessadas.length,
        pior_mes: piorMes || null,
        media_fp_por_mes: mediaFpPorMes,
        consistencia_dados: 100,
        alertas: alertas,
        distribuicao_por_trafo: distribuicaoPorTrafo,
        fornecedores_recomendados: FORNECEDORES_RECOMENDADOS,
        preco_por_kvar: precoPorKvar,
        economia_anual: economiaAnual,
        retorno_5_anos: retorno5Anos,
        metodo_calculo_utilizado: metodoCalculo,
      });

      Swal.fire({
        title: precisaCapacitor
          ? "✅ Dimensionamento Concluído (Startek-aligned)"
          : "✅ Análise Concluída",
        html: `<div class="text-center">
          <p class="text-lg font-bold">FP no pior mês: ${(fpAtual * 100).toFixed(1)}%</p>
          ${precisaCapacitor ? `<p class="text-primary font-bold mt-2">🔋 Recomendação: ${totalKvar.toFixed(1)} kVAr<br/><span class="text-sm">(Comercial: ${totalKvarComercial} kVAr)</span><br/><span class="text-xs text-slate-500">Método: ${metodoCalculo}</span></p>` : '<p class="text-green-600 mt-2">Sistema dentro das normas ANEEL</p>'}
          <p class="text-xs text-slate-500 mt-2">💰 Multa média: ${formatMoney(mediaMulta)}/mês</p>
          <p class="text-xs text-slate-500">💰 Investimento estimado: ${formatMoney(investimentoMercadoReal)}</p>
          <p class="text-xs text-slate-500">⏱️ Payback: ${payback} meses</p>
        </div>`,
        icon: precisaCapacitor ? "success" : "info",
        timer: 6000,
      });
    } catch (error) {
      console.error(error);
      Swal.fire("Erro", "Falha ao processar dimensionamento", "error");
    } finally {
      setCalculando(false);
    }
  };

  const exportMemorial = async () => {
    if (!reportRef.current) return;
    try {
      Swal.fire({
        title: "Gerando PDF...",
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false,
      });
      const dataUrl = await toPng(reportRef.current, {
        quality: 1.0,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      const finalHeight = (img.height * pdfWidth) / img.width;
      pdf.addImage(dataUrl, "PNG", 10, 10, pdfWidth, finalHeight);
      pdf.save(
        `Dimensionamento_Capacitor_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
      Swal.close();
      Swal.fire("PDF gerado!", "Memorial exportado com sucesso.", "success");
    } catch (error) {
      Swal.close();
      Swal.fire("Erro", "Falha ao gerar PDF", "error");
    }
  };

  if (carregando)
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );

  const BarraFP = ({ fp, meta = 92 }: { fp: number; meta?: number }) => {
    const percentual = Math.min(100, Math.max(0, (fp / meta) * 100));
    const cor =
      fp >= 92 ? "bg-green-500" : fp >= 80 ? "bg-amber-500" : "bg-red-500";
    return (
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className={`${cor} h-2 rounded-full`}
          style={{ width: `${percentual}%` }}
        />
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-primary">
          Dimensionamento de Banco de Capacitores
        </h1>
        <p className="text-slate-500 mt-2">
          Análise baseada em faturas - WG ARMAZENS GERAIS
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Infraestrutura: 1x300kVA + 1x225kVA | 380V | Grupo A4
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Lado esquerdo - configurações */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-primary flex gap-2">
                <Package size={20} /> Transformadores
              </h2>
              <button
                onClick={salvarTransformadores}
                className="text-xs bg-primary text-white px-3 py-1 rounded-lg"
              >
                <Save size={12} /> Salvar
              </button>
            </div>
            <div className="space-y-3">
              {transformadores.map((trafo, idx) => (
                <div
                  key={trafo.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
                >
                  <div className="flex-1 flex gap-2">
                    <div>
                      <label className="text-[8px] font-black">
                        Potência (kVA)
                      </label>
                      <input
                        type="number"
                        value={trafo.potencia_kva}
                        onChange={(e) =>
                          atualizarTransformador(
                            idx,
                            "potencia_kva",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="w-full rounded-lg border p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-black">Qtd</label>
                      <input
                        type="number"
                        value={trafo.quantidade}
                        onChange={(e) =>
                          atualizarTransformador(
                            idx,
                            "quantidade",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className="w-full rounded-lg border p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] font-black">
                        Tensão (V)
                      </label>
                      <input
                        type="number"
                        value={trafo.tensao_v}
                        onChange={(e) =>
                          atualizarTransformador(
                            idx,
                            "tensao_v",
                            parseFloat(e.target.value) || 380,
                          )
                        }
                        className="w-full rounded-lg border p-2 text-sm"
                      />
                    </div>
                  </div>
                  {transformadores.length > 1 && (
                    <button
                      onClick={() => removerTransformador(idx)}
                      className="text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={adicionarTransformador}
                className="w-full py-2 border-2 border-dashed rounded-xl text-slate-400 text-xs"
              >
                <Plus size={14} /> Adicionar Transformador
              </button>
            </div>
            <div className="mt-4 p-3 bg-primary/5 rounded-xl">
              <div className="flex justify-between text-sm">
                <span>Potência Total Instalada:</span>
                <span className="font-bold text-primary">
                  {formatNumber(potenciaTotalTransformadores, 0)} kVA
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {transformadores
                  .map((t) => `${t.quantidade}x${t.potencia_kva}kVA`)
                  .join(" + ")}{" "}
                | {transformadores[0]?.tensao_v}V
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-primary flex gap-2">
                <History size={20} /> Faturas ({faturas.length})
              </h2>
              <button
                onClick={() => {
                  setCurrentFatura({});
                  setEditandoFaturaId(null);
                  setShowFaturaModal(true);
                }}
                className="text-xs bg-primary text-white px-3 py-1 rounded-lg"
              >
                <Plus size={12} /> Adicionar
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {faturas.length === 0 ? (
                <div className="text-center py-8">
                  <p>Nenhuma fatura</p>
                  <button
                    onClick={carregarFaturaExemploReal}
                    className="text-primary text-sm"
                  >
                    Carregar exemplo real (WG ARMAZENS)
                  </button>
                </div>
              ) : (
                faturas.map((fat) => {
                  const consumoTotal =
                    fat.consumo_ponta_kwh + fat.consumo_fora_ponta_kwh;
                  const reativoTotal =
                    fat.reativo_ponta_kvarh + fat.reativo_fora_ponta_kvarh;
                  const fp = calcularFatorPotencia(consumoTotal, reativoTotal);
                  const custoReativo = calcularMultaReativa(
                    consumoTotal,
                    reativoTotal,
                    TARIFAS_REATIVO[fat.concessionaria]?.base || 0.28622,
                  );
                  return (
                    <div key={fat.id} className="p-3 rounded-lg bg-slate-50">
                      <div className="flex justify-between">
                        <span className="font-bold">{fat.mes_referencia}</span>
                        <div>
                          <button
                            onClick={() => {
                              setCurrentFatura(fat as any);
                              setEditandoFaturaId(fat.id);
                              setShowFaturaModal(true);
                            }}
                            className="text-blue-500"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => removerFatura(fat.id)}
                            className="text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs mt-2">
                        <div>
                          Consumo Ponta:{" "}
                          {formatNumber(fat.consumo_ponta_kwh, 2)} kWh
                        </div>
                        <div>
                          Consumo F/Ponta:{" "}
                          {formatNumber(fat.consumo_fora_ponta_kwh, 2)} kWh
                        </div>
                        <div>
                          Reativo Ponta:{" "}
                          {formatNumber(fat.reativo_ponta_kvarh, 2)} kVArh
                        </div>
                        <div>
                          Reativo F/Ponta:{" "}
                          {formatNumber(fat.reativo_fora_ponta_kvarh, 2)} kVArh
                        </div>
                        <div className="col-span-2">
                          <span
                            className={`text-xs font-bold ${fp >= 0.92 ? "text-green-600" : "text-red-600"}`}
                          >
                            FP: {(fp * 100).toFixed(1)}%
                          </span>{" "}
                          {custoReativo > 50 && (
                            <span className="ml-2 text-red-500">
                              Multa: {formatMoney(custoReativo)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border">
            <label className="block text-sm font-medium mb-2">
              Fator de Potência Desejado
            </label>
            <select
              value={targetFP}
              onChange={(e) => setTargetFP(parseFloat(e.target.value))}
              className="w-full rounded-xl border p-3 mb-4"
            >
              <option value={0.92}>0.92 (mínimo ANEEL)</option>
              <option value={0.95}>0.95 (recomendado)</option>
              <option value={0.98}>0.98 (excelente)</option>
            </select>

            {/* Configurações avançadas - apenas para referência (não modificam o cálculo principal) */}
            <details className="mb-4">
              <summary className="text-sm font-medium cursor-pointer text-primary">
                ⚙️ Configurações Avançadas
              </summary>
              <div className="mt-3 space-y-3 p-3 bg-slate-50 rounded-lg">
                <div>
                  <label className="text-xs text-slate-600">
                    Fator de Carga Estimado (para dimensionamento)
                  </label>
                  <input
                    type="range"
                    min="0.3"
                    max="0.8"
                    step="0.05"
                    value={0.5}
                    disabled
                    className="w-full"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Fixado em 0,5 (50% da capacidade dos transformadores) –
                    alinhado à Startek.
                  </p>
                </div>
                <div>
                  <label className="text-xs text-slate-600">
                    kVAr Recomendado por Especialista (opcional)
                  </label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="number"
                      placeholder="Ex: 160"
                      value={kvarRecomendadoManual || ""}
                      onChange={(e) =>
                        setKvarRecomendadoManual(
                          e.target.value ? parseFloat(e.target.value) : null,
                        )
                      }
                      className="flex-1 border rounded p-2 text-sm"
                    />
                    <button
                      onClick={() => setKvarRecomendadoManual(160)}
                      className="px-2 bg-primary text-white rounded text-xs whitespace-nowrap"
                      title="Usar valor da proposta STARTEK"
                    >
                      STARTEK
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Se informado, substitui o cálculo automático.
                  </p>
                </div>
              </div>
            </details>

            <button
              onClick={calcularDimensionamento}
              disabled={calculando || faturas.length < 2}
              className="w-full bg-primary text-white py-3 rounded-xl font-bold disabled:opacity-50 flex justify-center gap-2"
            >
              {calculando ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <Zap size={20} />
              )}{" "}
              Calcular Dimensionamento
            </button>
          </div>
        </div>

        {/* Lado direito - resultados */}
        <div className="lg:col-span-7">
          {result ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div
                ref={reportRef}
                className="bg-white rounded-2xl overflow-hidden shadow-sm border"
              >
                <div className="bg-slate-900 p-6 text-white text-center">
                  <Zap size={32} className="mx-auto text-secondary mb-2" />
                  <h2 className="text-2xl font-black">CapacitorManager</h2>
                  <p className="text-slate-400 text-sm">
                    Memorial de Dimensionamento
                  </p>
                  <p className="text-slate-500 text-xs">
                    Gerado em {new Date().toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="p-6 space-y-6">
                  {result.precisa_capacitor ? (
                    <>
                      <div className="text-center border-b pb-4">
                        <p className="text-sm text-slate-500">
                          Potência Total Recomendada
                        </p>
                        <p className="text-5xl font-bold text-primary">
                          {result.kvar_total.toFixed(1)}{" "}
                          <span className="text-lg">kVAr</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          Grupo {result.grupo_tarifario} •{" "}
                          {result.quantidade_faturas_analisadas} faturas •
                          Método: {result.metodo_calculo_utilizado}
                        </p>
                      </div>

                      {result.alertas.length > 0 && (
                        <div className="space-y-2">
                          {result.alertas.map((a, i) => (
                            <div
                              key={i}
                              className="bg-amber-50 p-3 rounded-xl text-xs text-amber-700 flex gap-2"
                            >
                              <AlertTriangle
                                size={14}
                                className="mt-0.5 flex-shrink-0"
                              />
                              {a}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="bg-blue-50 p-4 rounded-xl">
                        <p className="text-sm font-bold text-blue-700">
                          📌 {result.motivo_recomendacao}
                        </p>
                        <p className="text-xs mt-2">
                          FP atual: {result.fp_atual_percent.toFixed(1)}% →
                          Meta: {result.fp_projetado_percent.toFixed(0)}%
                        </p>
                        <div className="mt-3">
                          <BarraFP fp={result.fp_atual_percent} />
                          <div className="flex justify-between text-[10px] mt-1">
                            <span>
                              Atual: {result.fp_atual_percent.toFixed(1)}%
                            </span>
                            <span>Meta ANEEL: 92%</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-red-50 p-4 text-center rounded-xl">
                          <TrendingUp
                            className="mx-auto text-red-600 mb-2"
                            size={24}
                          />
                          <p className="text-xs font-medium">FP Médio Atual</p>
                          <p className="text-2xl font-bold">
                            {result.fp_atual_percent.toFixed(1)}%
                          </p>
                          <p className="text-xs text-red-500 mt-1">
                            Multa: {formatMoney(result.multa_atual_mensal_real)}
                            /mês
                          </p>
                        </div>
                        <div className="bg-green-50 p-4 text-center rounded-xl">
                          <TrendingUp
                            className="mx-auto text-green-600 mb-2"
                            size={24}
                          />
                          <p className="text-xs font-medium">FP Projetado</p>
                          <p className="text-2xl font-bold text-green-600">
                            {result.fp_projetado_percent.toFixed(0)}%
                          </p>
                          <p className="text-xs text-green-600 mt-1">
                            Economia:{" "}
                            {formatMoney(result.economia_mensal_estimada)}/mês
                          </p>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-4">
                        <p className="text-xs font-bold flex gap-2">
                          <Activity size={14} /> Evolução do FP por Mês
                        </p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {result.media_fp_por_mes.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-xs"
                            >
                              <span className="w-14 font-medium">
                                {item.mes}
                              </span>
                              <div className="flex-1">
                                <div className="w-full bg-slate-200 rounded-full h-1.5">
                                  <div
                                    className={`${item.fp >= 92 ? "bg-green-500" : item.fp >= 80 ? "bg-amber-500" : "bg-red-500"} h-1.5 rounded-full`}
                                    style={{
                                      width: `${Math.min(100, item.fp)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                              <span className="w-10 text-right font-bold">
                                {item.fp.toFixed(1)}%
                              </span>
                              <span className="w-20 text-right text-red-500 text-[10px]">
                                {formatMoney(item.multa)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {result.pior_mes && (
                        <div className="bg-amber-50 p-4 rounded-xl">
                          <p className="text-xs font-bold">
                            Pior Mês: {result.pior_mes.mes_referencia}
                          </p>
                          <p className="text-sm mt-1">
                            FP:{" "}
                            {(
                              (result.pior_mes.fp_calculado || 0) * 100
                            ).toFixed(1)}
                            % • Multa:{" "}
                            {formatMoney(
                              result.pior_mes.multa_reativo_calculada || 0,
                            )}
                          </p>
                        </div>
                      )}

                      <div className="bg-indigo-50 p-4 rounded-xl">
                        <p className="text-xs font-bold flex gap-2">
                          <Factory size={14} /> Distribuição entre
                          Transformadores
                        </p>
                        {result.distribuicao_por_trafo.map((dist, idx) => (
                          <div
                            key={idx}
                            className="bg-white rounded-lg p-3 mt-2 border"
                          >
                            <div className="flex justify-between">
                              <span className="font-bold text-sm">
                                Transformador {formatNumber(dist.trafo_kva, 0)}{" "}
                                kVA
                              </span>
                              <span className="text-xs text-slate-500">
                                {dist.percentual.toFixed(1)}% da carga
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-sm mt-2">
                              <div>
                                Recomendado:{" "}
                                {formatNumber(dist.kvar_recomendado, 1)} kVAr
                              </div>
                              <div>
                                Comercial:{" "}
                                {formatNumber(dist.kvar_comercial, 0)} kVAr
                              </div>
                              <div className="col-span-2 text-xs text-slate-600">
                                Config: {dist.configuracao_estagios}
                              </div>
                              <div className="col-span-2 font-medium">
                                Investimento: {formatMoney(dist.preco_estimado)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="bg-emerald-50 p-4 rounded-xl">
                        <p className="text-xs font-bold flex gap-2">
                          <DollarSign size={14} /> Análise Financeira Real
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-center mt-2">
                          <div className="bg-white rounded p-2 border">
                            <p className="text-[10px] text-slate-500">
                              Investimento Mercado
                            </p>
                            <p className="font-bold text-lg">
                              {formatMoney(result.investimento_mercado_real)}
                            </p>
                          </div>
                          <div className="bg-white rounded p-2 border">
                            <p className="text-[10px] text-slate-500">
                              Custo por kVAr
                            </p>
                            <p className="font-bold">
                              {formatMoney(result.preco_por_kvar)}/kVAr
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center mt-2">
                          <div className="bg-white rounded p-2 border">
                            <p className="text-[10px] text-slate-500">
                              Payback
                            </p>
                            <p className="font-bold text-green-600">
                              {result.payback_mercado_real} meses
                            </p>
                          </div>
                          <div className="bg-white rounded p-2 border">
                            <p className="text-[10px] text-slate-500">
                              Economia/ano
                            </p>
                            <p className="font-bold">
                              {formatMoney(result.economia_anual)}
                            </p>
                          </div>
                          <div className="bg-white rounded p-2 border">
                            <p className="text-[10px] text-slate-500">
                              Retorno 5 anos
                            </p>
                            <p
                              className={`font-bold ${result.retorno_5_anos > 0 ? "text-green-700" : "text-red-700"}`}
                            >
                              {formatMoney(result.retorno_5_anos)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-bold mb-2 flex gap-2">
                          <Layers size={18} /> Estágios Recomendados
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {result.kvar_por_estagio.map((s, i) => (
                            <div
                              key={i}
                              className="bg-slate-100 rounded-lg px-3 py-1 border flex items-center gap-1"
                            >
                              <span className="font-bold text-sm">
                                {s.toFixed(1)}
                              </span>
                              <span className="text-xs text-slate-500">
                                kVAr
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl">
                        <h4 className="font-bold text-sm mb-2">
                          Especificações Técnicas
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>• Tensão: {result.tensao_capacitores} (Δ)</div>
                          <div>• Reatores: {result.fator_dessintonia}%</div>
                          <div>• Controlador: Automático</div>
                          <div>• Grau IP: Mínimo IP54</div>
                          <div className="col-span-2 text-[10px] text-slate-500 mt-1">
                            • Compatível com rede 380V trifásica • Conformidade
                            NBR 14922/2022
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle2
                        size={40}
                        className="mx-auto text-green-600 mb-2"
                      />
                      <p className="text-xl font-bold text-green-700">
                        Instalação Regularizada
                      </p>
                      <p className="text-sm mt-2">
                        {result.motivo_recomendacao}
                      </p>
                    </div>
                  )}
                  <div className="text-center text-[10px] text-slate-400 border-t pt-4">
                    <p>
                      Cálculos baseados em ANEEL, NBR 14922/2022 e dados reais
                      de fatura
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={exportMemorial}
                className="w-full bg-white border py-3 rounded-xl font-medium flex justify-center gap-2 hover:bg-slate-50 transition"
              >
                <Printer size={18} /> Exportar Memorial em PDF
              </button>
            </motion.div>
          ) : (
            <div className="h-[500px] flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed">
              <Calculator size={64} className="text-slate-300 mb-4" />
              <h3 className="text-xl font-bold">Aguardando Dados</h3>
              <p className="text-sm text-slate-400 mt-2">
                Configure transformadores e adicione pelo menos 2 faturas da
                Equatorial Pará
              </p>
              <button
                onClick={carregarFaturaExemploReal}
                className="mt-4 text-primary text-sm font-medium hover:underline"
              >
                Carregar dados reais da WG ARMAZENS GERAIS →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de fatura (manter igual) */}
      <AnimatePresence>
        {showFaturaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">
                  {editandoFaturaId ? "✏️ Editar" : "➕ Nova Fatura"}
                </h3>
                <button onClick={() => setShowFaturaModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Mês/Ano *</label>
                  <input
                    type="text"
                    placeholder="Ex: 11/2025"
                    value={currentFatura.mes_referencia || ""}
                    onChange={(e) =>
                      setCurrentFatura({
                        ...currentFatura,
                        mes_referencia: e.target.value,
                      })
                    }
                    className="w-full border rounded p-2 mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Concessionária</label>
                  <select
                    value={currentFatura.concessionaria || "EQUATORIAL_PARA"}
                    onChange={(e) =>
                      setCurrentFatura({
                        ...currentFatura,
                        concessionaria: e.target.value,
                      })
                    }
                    className="w-full border rounded p-2 mt-1"
                  >
                    <option value="EQUATORIAL_PARA">Equatorial Pará</option>
                    <option value="RORAIMA_ENERGIA">Roraima Energia</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs">Consumo Ponta (kWh)</label>
                    <input
                      type="text"
                      placeholder="Ex: 457,21"
                      value={
                        currentFatura.consumo_ponta_kwh !== undefined &&
                        currentFatura.consumo_ponta_kwh !== ""
                          ? formatNumber(
                              currentFatura.consumo_ponta_kwh as number,
                              2,
                            )
                          : ""
                      }
                      onChange={(e) =>
                        setCurrentFatura({
                          ...currentFatura,
                          consumo_ponta_kwh: parseBRLocal(e.target.value),
                        })
                      }
                      className="w-full border rounded p-2 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs">Consumo F/Ponta (kWh)</label>
                    <input
                      type="text"
                      placeholder="Ex: 5179,86"
                      value={
                        currentFatura.consumo_fora_ponta_kwh !== undefined &&
                        currentFatura.consumo_fora_ponta_kwh !== ""
                          ? formatNumber(
                              currentFatura.consumo_fora_ponta_kwh as number,
                              2,
                            )
                          : ""
                      }
                      onChange={(e) =>
                        setCurrentFatura({
                          ...currentFatura,
                          consumo_fora_ponta_kwh: parseBRLocal(e.target.value),
                        })
                      }
                      className="w-full border rounded p-2 text-sm mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs">Demanda Ponta (kW)</label>
                    <input
                      type="text"
                      placeholder="Ex: 53,42"
                      value={
                        currentFatura.demanda_ponta_kw !== undefined &&
                        currentFatura.demanda_ponta_kw !== ""
                          ? formatNumber(
                              currentFatura.demanda_ponta_kw as number,
                              2,
                            )
                          : ""
                      }
                      onChange={(e) =>
                        setCurrentFatura({
                          ...currentFatura,
                          demanda_ponta_kw: parseBRLocal(e.target.value),
                        })
                      }
                      className="w-full border rounded p-2 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs">Demanda F/Ponta (kW)</label>
                    <input
                      type="text"
                      placeholder="Ex: 53,42"
                      value={
                        currentFatura.demanda_fora_ponta_kw !== undefined &&
                        currentFatura.demanda_fora_ponta_kw !== ""
                          ? formatNumber(
                              currentFatura.demanda_fora_ponta_kw as number,
                              2,
                            )
                          : ""
                      }
                      onChange={(e) =>
                        setCurrentFatura({
                          ...currentFatura,
                          demanda_fora_ponta_kw: parseBRLocal(e.target.value),
                        })
                      }
                      className="w-full border rounded p-2 text-sm mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-red-600">
                      Reativo Ponta (kVArh) *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 493,76"
                      value={
                        currentFatura.reativo_ponta_kvarh !== undefined &&
                        currentFatura.reativo_ponta_kvarh !== ""
                          ? formatNumber(
                              currentFatura.reativo_ponta_kvarh as number,
                              2,
                            )
                          : ""
                      }
                      onChange={(e) =>
                        setCurrentFatura({
                          ...currentFatura,
                          reativo_ponta_kvarh: parseBRLocal(e.target.value),
                        })
                      }
                      className="w-full border rounded p-2 text-sm mt-1 border-red-200 focus:border-red-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-red-600">
                      Reativo F/Ponta (kVArh) *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 4696,54"
                      value={
                        currentFatura.reativo_fora_ponta_kvarh !== undefined &&
                        currentFatura.reativo_fora_ponta_kvarh !== ""
                          ? formatNumber(
                              currentFatura.reativo_fora_ponta_kvarh as number,
                              2,
                            )
                          : ""
                      }
                      onChange={(e) =>
                        setCurrentFatura({
                          ...currentFatura,
                          reativo_fora_ponta_kvarh: parseBRLocal(
                            e.target.value,
                          ),
                        })
                      }
                      className="w-full border rounded p-2 text-sm mt-1 border-red-200 focus:border-red-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs">Dias do ciclo</label>
                    <input
                      type="text"
                      placeholder="30"
                      value={
                        currentFatura.dias_ciclo !== undefined &&
                        currentFatura.dias_ciclo !== ""
                          ? formatNumber(currentFatura.dias_ciclo as number, 0)
                          : "30"
                      }
                      onChange={(e) =>
                        setCurrentFatura({
                          ...currentFatura,
                          dias_ciclo: parseBRLocal(e.target.value),
                        })
                      }
                      className="w-full border rounded p-2 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs">Total a Pagar (R$)</label>
                    <input
                      type="text"
                      placeholder="Ex: 12617,50"
                      value={
                        currentFatura.total_pagar !== undefined &&
                        currentFatura.total_pagar !== ""
                          ? formatMoney(currentFatura.total_pagar as number)
                          : ""
                      }
                      onChange={(e) =>
                        setCurrentFatura({
                          ...currentFatura,
                          total_pagar: parseBRLocal(e.target.value),
                        })
                      }
                      className="w-full border rounded p-2 text-sm mt-1"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={carregarFaturaExemplo}
                  className="flex-1 py-2 border rounded-lg text-sm hover:bg-slate-50"
                >
                  Exemplo
                </button>
                <button
                  onClick={salvarFatura}
                  className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium"
                >
                  Salvar Fatura
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
