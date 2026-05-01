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
  Download,
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
// CONSTANTES E CONFIGURAÇÕES
// ============================================

const FP_MINIMO_REGULAMENTAR = 0.92;
const TARIFA_REATIVO = 0.34469; // mantido do original, mas será substituído pelas faturas

const TARIFAS_REATIVO: Record<string, { base: number; data_referencia: string; observacao: string }> = {
  EQUATORIAL_PARA: { base: 0.28622, data_referencia: "12/2025", observacao: "Tarifa do reativo excedente - fatura Dez/2025" },
  RORAIMA_ENERGIA: { base: 0.30603, data_referencia: "06/2025", observacao: "Tarifa para reativo excedente" },
  DEFAULT: { base: 0.28622, data_referencia: "padrão", observacao: "Valor baseado na Equatorial Pará" },
};

const PRECOS_MERCADO_CAPACITORES: Record<string, { preco_medio: number; faixa_preco: string; fornecedores: string[] }> = {
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
  { nome: "WEG", site: "www.weg.net", telefone: "0800 019 3030", especialidade: "Equipamentos industriais premium" },
  { nome: "FASF", site: "www.fasf.com.br", telefone: "(11) 2107-7400", especialidade: "Bancos de capacitores especializados" },
  { nome: "5G Equipamentos", site: "www.5geq.com.br", telefone: "(11) 2626-9090", especialidade: "Custo-benefício" },
  { nome: "ABB", site: "new.abb.com/br", telefone: "0800 014 9111", especialidade: "Tecnologia suíça, alta confiabilidade" },
  { nome: "Siemens", site: "www.siemens.com/br", telefone: "0800 275 2765", especialidade: "Automação e energia" },
];

const CONFIG_CAPACITORES = {
  tensao_padrao_380v: "440V",
  tensao_padrao_220v: "260V",
  margem_seguranca: 1.10,
  minimo_kvar_grupo_a: 20,
  minimo_kvar_grupo_b: 10,
  estagios_padrao: [60, 50, 40, 30, 25, 20, 15, 12.5, 10, 7.5, 5, 2.5],
  dessintonia_padrao: 7,
};

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
}

// ============================================
// UTILITÁRIOS DE CÁLCULO
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
  const aparente = Math.sqrt(Math.pow(ativo_kwh, 2) + Math.pow(reativo_kvarh, 2));
  if (aparente === 0) return 0.92;
  return Math.min(0.99, Math.max(0.30, ativo_kwh / aparente));
};

const calcularReativoExcedente = (ativo_kwh: number, reativo_kvarh: number): number => {
  const fp = calcularFatorPotencia(ativo_kwh, reativo_kvarh);
  if (fp >= FP_MINIMO_REGULAMENTAR) return 0;
  const reativo_permitido = FP_MINIMO_REGULAMENTAR * ativo_kwh;
  return Math.max(0, reativo_kvarh - reativo_permitido);
};

const calcularMultaReativa = (
  ativo_kwh: number,
  reativo_kvarh: number,
  tarifa_reativo: number
): number => {
  const excedente = calcularReativoExcedente(ativo_kwh, reativo_kvarh);
  return excedente * tarifa_reativo;
};

const calcularKvarNecessario = (
  potencia_ativa_kw: number,
  fp_atual: number,
  fp_desejado: number
): number => {
  const fp_atual_seguro = Math.min(0.99, Math.max(0.30, fp_atual));
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
  const potencias = Object.keys(PRECOS_MERCADO_CAPACITORES).map(Number).sort((a, b) => a - b);
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
  kvarTotalComercial: number
): DistribuicaoTrafo[] => {
  const potenciaTotal = transformadores.reduce((acc, t) => acc + t.potencia_kva * t.quantidade, 0);
  return transformadores.map(trafo => {
    const potenciaTrafo = trafo.potencia_kva * trafo.quantidade;
    const percentual = potenciaTrafo / potenciaTotal;
    const kvarRecomendado = kvarTotalComercial * percentual;
    const kvarComercial = Math.ceil(kvarRecomendado / 10) * 10;
    const precoEstimado = calcularPrecoMercado(kvarComercial);
    
    let configuracaoEstagios = "";
    if (kvarComercial <= 30) configuracaoEstagios = `${kvarComercial} kVAr (estágio único)`;
    else if (kvarComercial <= 60) configuracaoEstagios = `${Math.round(kvarComercial/2)} + ${Math.round(kvarComercial/2)} kVAr`;
    else if (kvarComercial <= 100) configuracaoEstagios = `${Math.round(kvarComercial/3)} + ${Math.round(kvarComercial/3)} + ${Math.round(kvarComercial/3)} kVAr`;
    else configuracaoEstagios = `${Math.round(kvarComercial/0.6/100)*60} + ${kvarComercial - Math.round(kvarComercial/0.6/100)*60} kVAr`;
    
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

export default function DimensionarPage() {
  const reportRef = useRef<HTMLDivElement>(null);

 const [transformadores, setTransformadores] = useState<Transformador[]>([
  { id: "1", potencia_kva: 300, quantidade: 1, tensao_v: 380, horas_trabalho: 220 },
  { id: "2", potencia_kva: 225, quantidade: 1, tensao_v: 380, horas_trabalho: 220 },
]);

  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [targetFP, setTargetFP] = useState<number>(0.95);
  const [result, setResult] = useState<ResultadoDimensionamento | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [showFaturaModal, setShowFaturaModal] = useState(false);
  const [currentFatura, setCurrentFatura] = useState<Partial<Fatura>>({});
  const [editandoFaturaId, setEditandoFaturaId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);

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
      total_pagar: 12617.50,
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
      total_pagar: 13728.12,
      dias_ciclo: 31,
      concessionaria: "EQUATORIAL_PARA",
      validado: true,
    },
  ];
  setFaturas(faturasCorretas);
  localStorage.setItem("dimensionar_faturas", JSON.stringify(faturasCorretas));
};

  const validarFatura = (fatura: Partial<Fatura>): { valida: boolean; mensagem: string } => {
    const consumoTotal = (fatura.consumo_ponta_kwh || 0) + (fatura.consumo_fora_ponta_kwh || 0);
    const reativoTotal = (fatura.reativo_ponta_kvarh || 0) + (fatura.reativo_fora_ponta_kvarh || 0);
    if (consumoTotal === 0 && reativoTotal === 0) {
      return { valida: false, mensagem: "Ambos os valores de consumo e reativo estão zerados." };
    }
    if (reativoTotal > consumoTotal && consumoTotal > 0) {
      const percentual = (reativoTotal / consumoTotal) * 100;
      if (percentual > 200) {
        return { valida: false, mensagem: `Reativo (${reativoTotal.toLocaleString()} kVArh) é ${percentual.toFixed(0)}% maior que o Consumo Ativo. Verifique se os valores estão trocados.` };
      }
    }
    const fp = calcularFatorPotencia(consumoTotal, reativoTotal);
    if (fp < 0.5 && consumoTotal > 0 && reativoTotal > 0) {
      return { valida: false, mensagem: `FP calculado é ${(fp*100).toFixed(1)}%. Verifique se os dados estão corretos.` };
    }
    return { valida: true, mensagem: "" };
  };

  const salvarTransformadores = () => {
    localStorage.setItem("dimensionar_transformadores", JSON.stringify(transformadores));
    Swal.fire({ title: "✅ Sucesso!", text: "Configuração dos transformadores salva!", icon: "success", timer: 1500, showConfirmButton: false });
  };

  const salvarFatura = () => {
    if (!currentFatura.mes_referencia) {
      Swal.fire("Atenção", "Informe o mês de referência", "warning");
      return;
    }
    const validacao = validarFatura(currentFatura);
    if (!validacao.valida) {
      Swal.fire({ title: "Dados inconsistentes", html: `<div class="text-left">${validacao.mensagem}</div>`, icon: "warning" });
      return;
    }
    
    const consumoPonta = parseBRLocal(currentFatura.consumo_ponta_kwh);
    const consumoForaPonta = parseBRLocal(currentFatura.consumo_fora_ponta_kwh);
    const reativoPonta = parseBRLocal(currentFatura.reativo_ponta_kvarh);
    const reativoForaPonta = parseBRLocal(currentFatura.reativo_fora_ponta_kvarh);
    const ativoTotal = consumoPonta + consumoForaPonta;
    const reativoTotal = reativoPonta + reativoForaPonta;
    const tarifaBase = TARIFAS_REATIVO[currentFatura.concessionaria as keyof typeof TARIFAS_REATIVO]?.base || TARIFAS_REATIVO.DEFAULT.base;
    const fpCalc = calcularFatorPotencia(ativoTotal, reativoTotal);
    const fpInf = currentFatura.fp_informado ? parseBRLocal(currentFatura.fp_informado) : undefined;
    
    const novaFatura: Fatura = {
      id: editandoFaturaId || Date.now().toString(),
      mes_referencia: currentFatura.mes_referencia,
      consumo_ponta_kwh: consumoPonta,
      consumo_fora_ponta_kwh: consumoForaPonta,
      demanda_ponta_kw: parseBRLocal(currentFatura.demanda_ponta_kw),
      demanda_fora_ponta_kw: parseBRLocal(currentFatura.demanda_fora_ponta_kw),
      reativo_ponta_kvarh: reativoPonta,
      reativo_fora_ponta_kvarh: reativoForaPonta,
      total_pagar: parseBRLocal(currentFatura.total_pagar),
      dias_ciclo: parseInt(currentFatura.dias_ciclo?.toString() || "30") || 30,
      concessionaria: currentFatura.concessionaria || "EQUATORIAL_PARA",
      validado: true,
      fp_calculado: fpCalc,
      fp_informado: fpInf,
      reativo_excedente_calculado: calcularReativoExcedente(ativoTotal, reativoTotal),
      multa_reativo_calculada: calcularMultaReativa(ativoTotal, reativoTotal, tarifaBase),
      tarifa_reativo_utilizada: tarifaBase,
    };

    let novasFaturas = [...faturas];
    if (editandoFaturaId) {
      const index = faturas.findIndex(f => f.id === editandoFaturaId);
      if (index !== -1) novasFaturas[index] = novaFatura;
      else novasFaturas = [novaFatura, ...novasFaturas];
    } else {
      novasFaturas = [novaFatura, ...novasFaturas];
    }
    novasFaturas.sort((a, b) => b.mes_referencia.localeCompare(a.mes_referencia));
    setFaturas(novasFaturas);
    localStorage.setItem("dimensionar_faturas", JSON.stringify(novasFaturas));
    setShowFaturaModal(false);
    setCurrentFatura({});
    setEditandoFaturaId(null);
    Swal.fire({ title: "✅ Sucesso!", text: "Fatura salva!", icon: "success", timer: 1500, showConfirmButton: false });
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
      title: "Remover fatura?", text: "Esta ação não pode ser desfeita.", icon: "warning", showCancelButton: true, confirmButtonColor: "#e74c3c", confirmButtonText: "Remover",
    }).then((result) => {
      if (result.isConfirmed) {
        const novasFaturas = faturas.filter(f => f.id !== id);
        setFaturas(novasFaturas);
        localStorage.setItem("dimensionar_faturas", JSON.stringify(novasFaturas));
        Swal.fire("Removida!", "Fatura removida com sucesso.", "success");
      }
    });
  };

  const adicionarTransformador = () => {
    const newId = (transformadores.length + 1).toString();
    setTransformadores([...transformadores, { id: newId, potencia_kva: 100, quantidade: 1, tensao_v: 220, horas_trabalho: 220 }]);
  };

  const removerTransformador = (index: number) => {
    if (transformadores.length > 1) setTransformadores(transformadores.filter((_, i) => i !== index));
  };

  const atualizarTransformador = (index: number, field: keyof Transformador, value: number) => {
    const novos = [...transformadores];
    novos[index] = { ...novos[index], [field]: value };
    setTransformadores(novos);
  };

  const potenciaTotalTransformadores = transformadores.reduce((acc, t) => acc + t.potencia_kva * t.quantidade, 0);

 const calcularDimensionamento = () => {
  if (faturas.length < 2) {
    Swal.fire("Atenção", "Mínimo de 2 faturas para dimensionamento confiável", "warning");
    return;
  }
  setCalculando(true);
  try {
    const alertas: string[] = [];
    let consistenciaData = 100;
    const concessionarias = [...new Set(faturas.map(f => f.concessionaria))];
    if (concessionarias.length > 1) {
      alertas.push(`⚠️ Faturas de diferentes concessionárias: ${concessionarias.join(", ")}`);
      consistenciaData -= 20;
    }
    const grupoTarifario = potenciaTotalTransformadores >= 75 ? "A" : "B";

    // Processa cada fatura e recalcula tudo do zero, SEM confiar em campos pré-calculados
    const faturasProcessadas = faturas.map(f => {
      const ativoTotal = (f.consumo_ponta_kwh || 0) + (f.consumo_fora_ponta_kwh || 0);
      const reativoTotal = (f.reativo_ponta_kvarh || 0) + (f.reativo_fora_ponta_kvarh || 0);
      
      // SE O REATIVO TOTAL FOR ZERO, EXIBE ALERTA
      if (reativoTotal === 0 && ativoTotal > 0) {
        alertas.push(`⚠️ Fatura ${f.mes_referencia} com reativo total ZERO. Verifique os dados.`);
      }
      
      const fp = calcularFatorPotencia(ativoTotal, reativoTotal);
      const tarifa = TARIFAS_REATIVO[f.concessionaria as keyof typeof TARIFAS_REATIVO]?.base || TARIFAS_REATIVO.DEFAULT.base;
      const multa = calcularMultaReativa(ativoTotal, reativoTotal, tarifa);
      const demandaMaxKw = Math.max(f.demanda_ponta_kw || 0, f.demanda_fora_ponta_kw || 0, 0.1);
      
      console.log(`Fatura ${f.mes_referencia}: Ativo=${ativoTotal}, Reativo=${reativoTotal}, FP=${fp}, Multa=${multa}, Demanda=${demandaMaxKw}`);
      
      return { ...f, ativoTotal, reativoTotal, fp, tarifa, multa, demandaMaxKw };
    });

    const demandaMaximaGlobal = Math.max(...faturasProcessadas.map(f => f.demandaMaxKw));
    const piorMes = faturasProcessadas.reduce((prev, curr) => (curr.fp < prev.fp ? curr : prev), faturasProcessadas[0]);
    const mediaMulta = faturasProcessadas.reduce((acc, f) => acc + f.multa, 0) / faturasProcessadas.length;

    const precisaCapacitor = piorMes.fp < FP_MINIMO_REGULAMENTAR || mediaMulta > 200;
    let totalKvar = 0, totalKvarComercial = 0, stages: number[] = [], economiaMensal = 0, investimento = 0, payback = 0, investimentoComercial = 0, paybackComercial = 0;
    let motivo = "";

    if (precisaCapacitor) {
      motivo = `FP no pior mês (${piorMes.mes_referencia}) = ${(piorMes.fp * 100).toFixed(1)}% - Multa mensal atual: ${formatMoney(mediaMulta)}`;
      totalKvar = calcularKvarNecessario(demandaMaximaGlobal, piorMes.fp, targetFP);
      totalKvar = Math.ceil(totalKvar * CONFIG_CAPACITORES.margem_seguranca / 2.5) * 2.5;
      totalKvar = Math.max(totalKvar, CONFIG_CAPACITORES.minimo_kvar_grupo_a);
      totalKvarComercial = Math.ceil(totalKvar / 10) * 10;
      stages = distribuirEstagios(totalKvar);
      // Considera que 90% da multa será eliminada após correção
      economiaMensal = mediaMulta * 0.90;
      const custoPorKvar = grupoTarifario === "A" ? 85 : 70;
      investimento = totalKvar * custoPorKvar + 2200;
      investimentoComercial = totalKvarComercial * custoPorKvar + 2200;
      payback = economiaMensal > 0 ? Math.ceil(investimento / economiaMensal) : 99;
      paybackComercial = economiaMensal > 0 ? Math.ceil(investimentoComercial / economiaMensal) : 99;
    } else {
      const mediaFp = faturasProcessadas.reduce((a,b)=>a+b.fp,0)/faturasProcessadas.length;
      motivo = `✅ Sistema regularizado (FP médio: ${(mediaFp * 100).toFixed(1)}%)`;
    }

    // Cálculo de preço de mercado (baseado na tabela)
    const investimentoMercadoReal = calcularPrecoMercado(totalKvarComercial);
    const paybackMercadoReal = economiaMensal > 0 ? Math.ceil(investimentoMercadoReal / economiaMensal) : 99;
    const economiaAnual = economiaMensal * 12;
    const retorno5Anos = (economiaAnual * 5) - investimentoMercadoReal;
    const precoPorKvar = investimentoMercadoReal / (totalKvarComercial || 1);
    const distribuicaoPorTrafo = distribuirKvarPorTrafo(transformadores, totalKvarComercial);
    const tensaoCapacitores = transformadores[0]?.tensao_v === 380 ? CONFIG_CAPACITORES.tensao_padrao_380v : CONFIG_CAPACITORES.tensao_padrao_220v;
    const mediaFpPorMes = faturasProcessadas.map(f => ({ mes: f.mes_referencia, fp: f.fp * 100, multa: f.multa })).sort((a,b) => a.fp - b.fp);

    setResult({
      kvar_total: totalKvar,
      kvar_total_comercial: totalKvarComercial,
      kvar_por_estagio: stages,
      tensao_capacitores: tensaoCapacitores,
      fator_dessintonia: CONFIG_CAPACITORES.dessintonia_padrao,
      economia_mensal_estimada: economiaMensal,
      investimento_estimado: investimento,
      investimento_estimado_comercial: investimentoComercial,
      investimento_mercado_real: investimentoMercadoReal,
      payback_meses: payback,
      payback_meses_comercial: paybackComercial,
      payback_mercado_real: paybackMercadoReal,
      fp_atual_percent: piorMes.fp * 100,
      fp_projetado_percent: precisaCapacitor ? targetFP * 100 : piorMes.fp * 100,
      multa_atual_mensal_real: mediaMulta,
      multa_atual_mensal_calculada: mediaMulta,
      consumo_ativo_medio_mensal_kwh: faturasProcessadas.reduce((a,b)=>a+b.ativoTotal,0)/faturasProcessadas.length,
      consumo_reativo_medio_mensal_kvarh: faturasProcessadas.reduce((a,b)=>a+b.reativoTotal,0)/faturasProcessadas.length,
      potencia_ativa_media_kw: demandaMaximaGlobal,
      precisa_capacitor: precisaCapacitor,
      grupo_tarifario: grupoTarifario,
      motivo_recomendacao: motivo,
      concessionaria_identificada: concessionarias[0] || "NÃO IDENTIFICADA",
      quantidade_faturas_analisadas: faturasProcessadas.length,
      pior_mes: piorMes,
      media_fp_por_mes: mediaFpPorMes,
      consistencia_dados: consistenciaData,
      alertas: alertas,
      distribuicao_por_trafo: distribuicaoPorTrafo,
      fornecedores_recomendados: FORNECEDORES_RECOMENDADOS,
      preco_por_kvar: precoPorKvar,
      economia_anual: economiaAnual,
      retorno_5_anos: retorno5Anos,
    });

    Swal.fire({
      title: precisaCapacitor ? "✅ Dimensionamento Concluído" : "✅ Análise Concluída",
      html: `<div class="text-center"><p class="text-lg font-bold">FP no pior mês: ${(piorMes.fp * 100).toFixed(1)}%</p>${precisaCapacitor ? `<p class="text-primary font-bold mt-2">🔋 Recomendação: ${totalKvar.toFixed(1)} kVAr<br/><span class="text-sm">(Comercial: ${totalKvarComercial} kVAr)</span></p>` : '<p class="text-green-600 mt-2">Sistema dentro das normas ANEEL</p>'}<p class="text-xs text-slate-500 mt-2">💰 Demanda máxima considerada: ${demandaMaximaGlobal.toFixed(1)} kW</p><p class="text-xs text-slate-500">💰 Multa média mensal: ${formatMoney(mediaMulta)}</p><p class="text-xs text-slate-500">💰 Investimento mercado: ${formatMoney(investimentoMercadoReal)}</p><p class="text-xs text-slate-500">⏱️ Payback: ${paybackMercadoReal} meses</p></div>`,
      icon: precisaCapacitor ? "success" : "info",
      timer: 5000,
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
      Swal.fire({ title: "Gerando PDF...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
      const dataUrl = await toPng(reportRef.current, { quality: 1.0, backgroundColor: "#ffffff", pixelRatio: 2 });
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });
      const imgRatio = img.width / img.height;
      const finalHeight = pdfWidth / imgRatio;
      pdf.addImage(dataUrl, "PNG", 10, 10, pdfWidth, finalHeight);
      pdf.save(`Dimensionamento_Capacitor_${new Date().toISOString().slice(0,10)}.pdf`);
      Swal.close();
      Swal.fire("PDF gerado!", "Memorial exportado com sucesso.", "success");
    } catch (error) {
      Swal.close();
      Swal.fire("Erro", "Falha ao gerar PDF", "error");
    }
  };

  if (carregando) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-primary" size={32} /></div>;

  const BarraFP = ({ fp, meta = 92 }: { fp: number; meta?: number }) => {
    const percentual = Math.min(100, Math.max(0, (fp / meta) * 100));
    const cor = fp >= 92 ? "bg-green-500" : fp >= 80 ? "bg-amber-500" : "bg-red-500";
    return <div className="w-full bg-slate-200 rounded-full h-2"><div className={`${cor} h-2 rounded-full transition-all duration-500`} style={{ width: `${percentual}%` }} /></div>;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-primary">Dimensionamento de Banco de Capacitores</h1>
        <p className="text-slate-500 mt-2">Análise baseada em faturas da RORAIMA ENERGIA</p>
        <p className="text-xs text-slate-400 mt-1">Infraestrutura: 7x225kVA + 1x75kVA | 220V</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          {/* Transformadores */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-primary flex items-center gap-2"><Package size={20} className="text-secondary" /> Transformadores</h2>
              <button onClick={salvarTransformadores} className="text-xs bg-primary text-white px-3 py-1 rounded-lg hover:bg-primary/90"><Save size={12} /> Salvar</button>
            </div>
            <div className="space-y-3">
              {transformadores.map((trafo, idx) => (
                <div key={trafo.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="flex-1 flex gap-2">
                    <div className="flex-1"><label className="text-[8px] font-black text-slate-400 uppercase">Potência (kVA)</label><input type="number" value={trafo.potencia_kva} onChange={(e) => atualizarTransformador(idx, "potencia_kva", parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 p-2 text-sm" /></div>
                    <div className="w-20"><label className="text-[8px] font-black text-slate-400 uppercase">Qtd</label><input type="number" value={trafo.quantidade} onChange={(e) => atualizarTransformador(idx, "quantidade", parseInt(e.target.value) || 0)} className="w-full rounded-lg border border-slate-200 p-2 text-sm" /></div>
                    <div className="w-24"><label className="text-[8px] font-black text-slate-400 uppercase">Tensão (V)</label><input type="number" value={trafo.tensao_v} onChange={(e) => atualizarTransformador(idx, "tensao_v", parseFloat(e.target.value) || 220)} className="w-full rounded-lg border border-slate-200 p-2 text-sm" /></div>
                  </div>
                  {transformadores.length > 1 && <button onClick={() => removerTransformador(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>}
                </div>
              ))}
              <button onClick={adicionarTransformador} className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold hover:border-secondary hover:text-secondary transition-all flex items-center justify-center gap-2"><Plus size={14} /> Adicionar Transformador</button>
            </div>
            <div className="mt-4 p-3 bg-primary/5 rounded-xl">
              <div className="flex justify-between text-sm"><span>Potência Total Instalada:</span><span className="font-bold text-primary">{potenciaTotalTransformadores.toLocaleString()} kVA</span></div>
              <div className="flex justify-between text-xs text-slate-500 mt-1"><span>Configuração:</span><span>{transformadores.map(t => `${t.quantidade}x${t.potencia_kva}kVA`).join(" + ")} | {transformadores[0]?.tensao_v}V</span></div>
            </div>
          </div>

          {/* Faturas */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-primary flex items-center gap-2"><History size={20} className="text-secondary" /> Faturas ({faturas.length})</h2>
              <button onClick={() => { setCurrentFatura({}); setEditandoFaturaId(null); setShowFaturaModal(true); }} className="text-xs bg-primary text-white px-3 py-1 rounded-lg hover:bg-primary/90"><Plus size={12} /> Adicionar</button>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {faturas.length === 0 ? (
                <div className="text-center py-8 text-slate-400"><p>Nenhuma fatura cadastrada</p><button onClick={carregarFaturaExemploReal} className="mt-2 text-primary text-sm hover:underline">Carregar fatura exemplo</button></div>
              ) : (
                faturas.map((fat) => {
                  const consumoTotal = fat.consumo_ponta_kwh + fat.consumo_fora_ponta_kwh;
                  const reativoTotal = fat.reativo_ponta_kvarh + fat.reativo_fora_ponta_kvarh;
                  const fp = calcularFatorPotencia(consumoTotal, reativoTotal);
                  const custoReativo = calcularMultaReativa(consumoTotal, reativoTotal, TARIFAS_REATIVO[fat.concessionaria as keyof typeof TARIFAS_REATIVO]?.base || 0.28622);
                  const isInvertido = reativoTotal > consumoTotal && consumoTotal > 0;
                  return (
                    <div key={fat.id} className={`p-3 rounded-lg ${isInvertido ? "bg-red-50 border border-red-200" : "bg-slate-50"}`}>
                      <div className="flex justify-between items-center"><span className="font-bold text-primary">{fat.mes_referencia}</span><div className="flex gap-1"><button onClick={() => { setCurrentFatura(fat); setEditandoFaturaId(fat.id); setShowFaturaModal(true); }} className="text-blue-500"><Edit3 size={14} /></button><button onClick={() => removerFatura(fat.id)} className="text-red-500"><Trash2 size={14} /></button></div></div>
                      <div className="grid grid-cols-2 gap-1 text-xs mt-2">
                        <div><span className="text-slate-500">Consumo Ponta:</span> {fat.consumo_ponta_kwh.toLocaleString()} kWh</div>
                        <div><span className="text-slate-500">Consumo F/Ponta:</span> {fat.consumo_fora_ponta_kwh.toLocaleString()} kWh</div>
                        <div><span className="text-slate-500">Demanda Ponta:</span> {fat.demanda_ponta_kw} kW</div>
                        <div><span className="text-slate-500">Demanda F/Ponta:</span> {fat.demanda_fora_ponta_kw} kW</div>
                        <div><span className="text-slate-500">Reativo Ponta:</span> {fat.reativo_ponta_kvarh.toLocaleString()} kVArh</div>
                        <div><span className="text-slate-500">Reativo F/Ponta:</span> {fat.reativo_fora_ponta_kvarh.toLocaleString()} kVArh</div>
                        <div className="col-span-2 mt-1 pt-1 border-t">
                          <span className={`text-xs font-bold ${fp >= 0.92 ? "text-green-600" : fp > 0.5 ? "text-amber-600" : "text-red-600"} flex items-center justify-between`}><span>FP: {(fp * 100).toFixed(1)}%</span>{custoReativo > 50 && <span>Custo Reativo: {formatMoney(custoReativo)}</span>}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Parâmetros */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-2">Fator de Potência Desejado</label>
            <select value={targetFP} onChange={(e) => setTargetFP(parseFloat(e.target.value))} className="w-full rounded-xl border border-slate-200 p-3 mb-6">
              <option value={0.92}>0.92 (mínimo regulamentar - ANEEL)</option>
              <option value={0.95}>0.95 (recomendado para economia)</option>
              <option value={0.98}>0.98 (excelente - maior investimento)</option>
            </select>
            <button onClick={calcularDimensionamento} disabled={calculando || faturas.length < 2} className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">{calculando ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />} Calcular Dimensionamento</button>
            {faturas.length < 2 && <p className="text-xs text-amber-600 mt-2 text-center">⚠️ Adicione pelo menos 2 faturas</p>}
          </div>
        </div>

        <div className="lg:col-span-7">
          {result ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div ref={reportRef} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                <div className="bg-slate-900 p-6 text-white text-center"><Zap size={32} className="mx-auto text-secondary mb-2" /><h2 className="text-2xl font-black">CapacitorManager</h2><p className="text-slate-400 text-sm">Memorial de Dimensionamento</p><p className="text-slate-500 text-xs mt-1">Gerado em {new Date().toLocaleDateString("pt-BR")}</p></div>
                <div className="p-6 space-y-6">
                  {result.precisa_capacitor ? (
                    <>
                      <div className="text-center border-b pb-4"><p className="text-sm text-slate-500">Potência Total Recomendada</p><p className="text-5xl font-bold text-primary">{result.kvar_total.toFixed(1)} <span className="text-lg">kVAr</span></p><p className="text-xs text-slate-400 mt-1">Grupo {result.grupo_tarifario} - {result.quantidade_faturas_analisadas} faturas analisadas</p></div>
                      {result.alertas.length > 0 && result.alertas.map((a,i) => <div key={i} className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700">{a}</div>)}
                      <div className="bg-blue-50 rounded-xl p-4"><p className="text-sm font-bold text-blue-700">📌 {result.motivo_recomendacao}</p><p className="text-xs text-blue-600 mt-1">FP atual: {result.fp_atual_percent.toFixed(1)}% → Meta: {result.fp_projetado_percent.toFixed(0)}%</p><div className="mt-3"><BarraFP fp={result.fp_atual_percent} meta={92} /><div className="flex justify-between text-[10px] text-slate-500 mt-1"><span>Atual: {result.fp_atual_percent.toFixed(1)}%</span><span>Meta ANEEL: 92%</span></div></div></div>
                      <div className="grid grid-cols-2 gap-4"><div className={`rounded-xl p-4 text-center ${result.fp_atual_percent < 92 ? "bg-red-50" : "bg-green-50"}`}><TrendingUp size={22} className={`mx-auto mb-2 ${result.fp_atual_percent < 92 ? "text-red-600" : "text-green-600"}`} /><p className="text-xs text-slate-500">FP Médio Atual</p><p className="text-2xl font-bold">{result.fp_atual_percent.toFixed(1)}%</p><p className="text-xs text-red-500 mt-1">Multa: {formatMoney(result.multa_atual_mensal_real)}/mês</p></div><div className="bg-green-50 rounded-xl p-4 text-center"><TrendingUp size={22} className="mx-auto text-green-600 mb-2" /><p className="text-xs text-slate-500">FP Projetado</p><p className="text-2xl font-bold text-green-600">{result.fp_projetado_percent.toFixed(0)}%</p><p className="text-xs text-green-600 mt-1">Economia: {formatMoney(result.economia_mensal_estimada)}/mês</p></div></div>
                      <div className="bg-slate-50 rounded-xl p-4"><p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2"><Activity size={14} /> Evolução do FP por Mês</p><div className="mb-3 p-2 bg-blue-50 rounded-lg text-xs text-blue-800">📊 Demanda ativa máxima considerada: <strong>{result.potencia_ativa_media_kw.toFixed(1)} kW</strong><span className="block text-[10px] text-blue-600 mt-0.5">(baseada na maior demanda registrada nas faturas – ponta ou fora ponta)</span></div><div className="space-y-2">{result.media_fp_por_mes.map((item, idx) => { const cor = item.fp >= 92 ? "text-green-600" : item.fp >= 80 ? "text-amber-600" : "text-red-600"; const barraCor = item.fp >= 92 ? "bg-green-500" : item.fp >= 80 ? "bg-amber-500" : "bg-red-500"; return (<div key={idx} className="flex items-center gap-2 text-xs"><span className="w-14 font-medium">{item.mes}</span><div className="flex-1"><div className="w-full bg-slate-200 rounded-full h-1.5"><div className={`${barraCor} h-1.5 rounded-full`} style={{ width: `${Math.min(100, item.fp)}%` }} /></div></div><span className={`w-10 text-right font-bold ${cor}`}>{item.fp.toFixed(1)}%</span><span className="w-20 text-right text-red-500 text-[10px]">{formatMoney(item.multa)}</span></div>); })}</div></div>
                      {result.pior_mes && <div className="bg-amber-50 rounded-xl p-4 border border-amber-200"><p className="text-xs font-bold text-amber-700 flex items-center gap-1 mb-2"><AlertTriangle size={14} /> Pior Mês do Período Analisado</p><div className="flex justify-between items-center"><div><p className="text-sm font-semibold">{result.pior_mes.mes_referencia}</p><p className="text-xs text-amber-600">FP: {(result.pior_mes.fp_calculado! * 100).toFixed(1)}% • Multa: {formatMoney(result.pior_mes.multa_reativo_calculada || 0)}</p></div></div></div>}
                      <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200"><p className="text-xs font-bold text-indigo-700 flex items-center gap-2 mb-3"><Factory size={14} /> Distribuição Recomendada entre Transformadores</p><div className="space-y-3">{result.distribuicao_por_trafo.map((dist, idx) => (<div key={idx} className="bg-white rounded-lg p-3"><div className="flex justify-between items-center mb-2"><span className="font-bold text-indigo-700">Transformador {dist.trafo_kva} kVA</span><span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{dist.percentual.toFixed(1)}% da carga</span></div><div className="grid grid-cols-2 gap-2 text-sm"><div><p className="text-xs text-slate-500">Potência recomendada:</p><p className="font-bold text-indigo-700">{dist.kvar_recomendado.toFixed(1)} kVAr</p></div><div><p className="text-xs text-slate-500">Valor comercial:</p><p className="font-bold text-primary">{dist.kvar_comercial} kVAr</p></div><div className="col-span-2"><p className="text-xs text-slate-500">Configuração sugerida:</p><p className="text-xs font-mono">{dist.configuracao_estagios}</p></div><div className="col-span-2"><p className="text-xs text-slate-500">Investimento estimado:</p><p className="text-sm font-bold text-green-700">{formatMoney(dist.preco_estimado)}</p></div></div></div>))}</div><div className="mt-3 p-2 bg-indigo-100 rounded-lg text-xs text-indigo-800">💡 <strong>Recomendação Técnica:</strong> Instalar um banco automático dedicado para cada transformador, próximo às cargas, para melhor eficiência.</div></div>
                      <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200"><p className="text-xs font-bold text-emerald-700 flex items-center gap-2 mb-3"><DollarSign size={14} /> Análise de Mercado e Investimento (2026)</p><div className="grid grid-cols-2 gap-3 mb-3"><div className="bg-white rounded-lg p-2 text-center"><p className="text-[10px] text-slate-500">Preço de mercado</p><p className="text-lg font-bold text-primary">{formatMoney(result.investimento_mercado_real)}</p></div><div className="bg-white rounded-lg p-2 text-center"><p className="text-[10px] text-slate-500">Custo por kVAr</p><p className="text-lg font-bold text-primary">{formatMoney(result.preco_por_kvar)}/kVAr</p></div></div><div className="grid grid-cols-3 gap-2 text-center text-xs mb-3"><div className="bg-white rounded-lg p-2"><p className="text-slate-500">Payback</p><p className="font-bold text-amber-700">{result.payback_mercado_real} meses</p><p className="text-[10px] text-slate-400">(~{(result.payback_mercado_real / 12).toFixed(1)} anos)</p></div><div className="bg-white rounded-lg p-2"><p className="text-slate-500">Economia/ano</p><p className="font-bold text-green-700">{formatMoney(result.economia_anual)}</p></div><div className="bg-white rounded-lg p-2"><p className="text-slate-500">Retorno 5 anos</p><p className={`font-bold ${result.retorno_5_anos > 0 ? 'text-green-700' : 'text-red-700'}`}>{formatMoney(result.retorno_5_anos)}</p></div></div>{result.payback_mercado_real <= 24 && <div className="bg-green-100 rounded-lg p-2 text-center text-xs text-green-800">✅ Investimento altamente atrativo! Retorno em menos de 2 anos.</div>}{result.payback_mercado_real > 24 && result.payback_mercado_real <= 36 && <div className="bg-amber-100 rounded-lg p-2 text-center text-xs text-amber-800">⚠️ Payback moderado. Ainda viável, mas negocie o preço.</div>}{result.payback_mercado_real > 36 && <div className="bg-red-100 rounded-lg p-2 text-center text-xs text-red-800">🔴 Payback elevado. Recomenda-se buscar múltiplos orçamentos.</div>}</div>
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200"><p className="text-xs font-bold text-slate-700 flex items-center gap-2 mb-3"><Truck size={14} /> Fornecedores Recomendados para Cotação</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{result.fornecedores_recomendados.map((forn, idx) => (<div key={idx} className="bg-white rounded-lg p-2 text-xs"><p className="font-bold text-primary">{forn.nome}</p><p className="text-slate-500 text-[10px]">{forn.especialidade}</p><a href={`https://${forn.site}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-[10px] hover:underline">{forn.site}</a></div>))}</div><p className="text-[10px] text-slate-400 mt-2 text-center">💡 Solicite orçamento para banco automático com controlador e reatores de {result.fator_dessintonia}%.</p></div>
                      <div><h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Layers size={18} className="text-primary" /> Distribuição dos Estágios</h3><div className="flex flex-wrap gap-2 mb-2">{result.kvar_por_estagio.map((s,i) => <div key={i} className="bg-slate-100 rounded-lg px-4 py-2 border"><span className="font-bold text-primary">{s.toFixed(1)} kVAr</span></div>)}</div><p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">Banco de {result.kvar_total.toFixed(1)} kVAr com {result.kvar_por_estagio.length} estágios: {result.kvar_por_estagio.map(s => `${s.toFixed(1)}`).join(" + ")} kVAr</p></div>
                      <div className="bg-slate-50 rounded-xl p-4"><h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2"><FileText size={16} className="text-primary" /> Especificações Técnicas (NBR 14922)</h4><div className="grid grid-cols-2 gap-3 text-xs"><div><p><span className="text-slate-400">Tensão capacitores:</span><br/><span className="font-bold">{result.tensao_capacitores} (Δ)</span></p><p><span className="text-slate-400">Reatores:</span><br/><span className="font-bold">{result.fator_dessintonia}%</span></p><p><span className="text-slate-400">Controlador:</span><br/><span className="font-bold">Automático digital</span></p></div><div><p><span className="text-slate-400">Grau IP:</span><br/><span className="font-bold">Mínimo IP54</span></p><p><span className="text-slate-400">Proteção:</span><br/><span className="font-bold">Fusíveis NH</span></p><p><span className="text-slate-400">Norma:</span><br/><span className="font-bold">NBR 14922/2022</span></p></div></div></div>
                    </>
                  ) : (
                    <div className="text-center py-8"><div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4"><CheckCircle2 size={40} className="text-green-600" /></div><p className="text-xl font-bold text-green-700 mb-2">Instalação Regularizada</p><p className="text-sm text-slate-500 max-w-md mx-auto">{result.motivo_recomendacao}</p></div>
                  )}
                  <div className="text-center text-[10px] text-slate-400 border-t pt-4"><p>Cálculos baseados na Resolução Normativa ANEEL 414/2010 e NBR 14922/2022</p><p>Preços de mercado baseados em pesquisa realizada em Abril/2026 (Mercado Livre e fornecedores nacionais)</p></div>
                </div>
              </div>
              <div className="flex gap-3"><button onClick={exportMemorial} className="flex-1 bg-white border border-slate-300 py-3 rounded-xl font-medium hover:bg-slate-50 flex justify-center gap-2"><Printer size={18} /> Exportar Memorial PDF</button></div>
            </motion.div>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"><Calculator size={64} className="text-slate-300 mb-4" /><h3 className="text-xl font-bold text-slate-500">Aguardando Dados</h3><p className="text-sm text-slate-400 mt-2 max-w-md">Configure os transformadores, adicione <strong>pelo menos 2 faturas</strong> e clique em "Calcular Dimensionamento"</p></div>
          )}
        </div>
      </div>

      {/* Modal de fatura */}
      <AnimatePresence>
        {showFaturaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-primary">{editandoFaturaId ? "✏️ Editar Fatura" : "➕ Nova Fatura"}</h3><button onClick={() => setShowFaturaModal(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} /></button></div>
              <div className="space-y-3">
                <div><label className="text-sm font-medium">Mês/Ano <span className="text-red-500">*</span></label><input type="text" placeholder="Ex: 05/2025" value={currentFatura.mes_referencia || ""} onChange={(e) => setCurrentFatura({ ...currentFatura, mes_referencia: e.target.value })} className="w-full rounded-lg border p-2" /></div>
                <div><label className="text-sm font-medium">Concessionária</label><select value={currentFatura.concessionaria || "EQUATORIAL_PARA"} onChange={(e) => setCurrentFatura({ ...currentFatura, concessionaria: e.target.value })} className="w-full rounded-lg border p-2"><option value="EQUATORIAL_PARA">Equatorial Pará</option><option value="RORAIMA_ENERGIA">Roraima Energia</option><option value="OUTRA">Outra</option></select></div>
                <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800"><p className="font-bold mb-1">📌 Como preencher corretamente:</p><p>• <strong>Consumo (kWh):</strong> valores altos (ex: 8.000 a 80.000)</p><p>• <strong>Reativo (kVArh):</strong> valores baixos (ex: 500 a 5.000)</p><p>• O Fator de Potência ideal deve ficar entre 80% e 99%</p></div>
                <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-medium">Consumo Ponta (kWh)</label><input type="number" placeholder="Ex: 8132" value={currentFatura.consumo_ponta_kwh || ""} onChange={(e) => setCurrentFatura({ ...currentFatura, consumo_ponta_kwh: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border p-2" /></div><div><label className="text-xs font-medium">Consumo Fora Ponta (kWh)</label><input type="number" placeholder="Ex: 59050" value={currentFatura.consumo_fora_ponta_kwh || ""} onChange={(e) => setCurrentFatura({ ...currentFatura, consumo_fora_ponta_kwh: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border p-2" /></div></div>
                <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-medium">Demanda Ponta (kW)</label><input type="number" placeholder="Ex: 430" value={currentFatura.demanda_ponta_kw || ""} onChange={(e) => setCurrentFatura({ ...currentFatura, demanda_ponta_kw: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border p-2" /></div><div><label className="text-xs font-medium">Demanda Fora Ponta (kW)</label><input type="number" placeholder="Ex: 447" value={currentFatura.demanda_fora_ponta_kw || ""} onChange={(e) => setCurrentFatura({ ...currentFatura, demanda_fora_ponta_kw: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border p-2" /></div></div>
                <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-medium">Reativo Ponta (kVArh)</label><input type="number" placeholder="Ex: 824" value={currentFatura.reativo_ponta_kvarh || ""} onChange={(e) => setCurrentFatura({ ...currentFatura, reativo_ponta_kvarh: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border p-2" /></div><div><label className="text-xs font-medium">Reativo Fora Ponta (kVArh)</label><input type="number" placeholder="Ex: 4511" value={currentFatura.reativo_fora_ponta_kvarh || ""} onChange={(e) => setCurrentFatura({ ...currentFatura, reativo_fora_ponta_kvarh: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border p-2" /></div></div>
                <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-medium">Dias do Ciclo</label><input type="number" placeholder="30" value={currentFatura.dias_ciclo || 30} onChange={(e) => setCurrentFatura({ ...currentFatura, dias_ciclo: parseInt(e.target.value) || 30 })} className="w-full rounded-lg border p-2" /></div><div><label className="text-xs font-medium">Total a Pagar (R$)</label><input type="number" step="0.01" placeholder="Ex: 55970.04" value={currentFatura.total_pagar || ""} onChange={(e) => setCurrentFatura({ ...currentFatura, total_pagar: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border p-2" /></div></div>
              </div>
              <div className="flex gap-3 mt-6"><button onClick={carregarFaturaExemplo} className="flex-1 py-2 border rounded-lg text-primary border-primary/30 hover:bg-primary/5 text-sm">Carregar Exemplo (05/2025)</button><button onClick={salvarFatura} className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">Salvar</button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}