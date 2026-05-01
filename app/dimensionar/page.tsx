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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";

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
  concessionaria: string; // <--- LINHA ADICIONADA!
  fp_calculado?: number;
  fp_informado?: number;
  reativo_excedente_calculado?: number;
  multa_reativo_calculada?: number;
  tarifa_reativo_utilizada?: number;
  validado: boolean;
}

interface ResultadoDimensionamento {
  totalKvar: number;
  stages: number[];
  economiaMensal: number;
  investimentoEstimado: number;
  paybackMeses: number;
  fpAtual: number;
  fpProjetado: number;
  multaAtual: number;
  consumoTotalMedio: number;
  potenciaAtivaMediaKw: number;
  piorMes: Fatura | null;
  recomendacaoEstagios: string;
  quantidadeFaturas: number;
  precisaCapacitor: boolean;
  grupoTarifario: "A" | "B";
  motivoRecomendacao: string;
  custoReativoMensal: number;
}

const TARIFA_REATIVO = 0.34469;

export default function DimensionarPage() {
  const reportRef = useRef<HTMLDivElement>(null);

  const [transformadores, setTransformadores] = useState<Transformador[]>([
    {
      id: "1",
      potencia_kva: 225,
      quantidade: 7,
      tensao_v: 220,
      horas_trabalho: 220,
    },
    {
      id: "2",
      potencia_kva: 75,
      quantidade: 1,
      tensao_v: 220,
      horas_trabalho: 220,
    },
  ]);

  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [targetFP, setTargetFP] = useState<number>(0.92);
  const [result, setResult] = useState<ResultadoDimensionamento | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [showFaturaModal, setShowFaturaModal] = useState(false);
  const [currentFatura, setCurrentFatura] = useState<Partial<Fatura>>({});
  const [editandoFatura, setEditandoFatura] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = () => {
    try {
      const savedTrafos = localStorage.getItem("dimensionar_transformadores");
      if (savedTrafos) {
        setTransformadores(JSON.parse(savedTrafos));
      }

      const savedFaturas = localStorage.getItem("dimensionar_faturas");
      if (savedFaturas) {
        const faturasCarregadas = JSON.parse(savedFaturas);
        setFaturas(faturasCarregadas);
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
    const faturaExemplo: Fatura = {
      id: "exemplo1",
      mes_referencia: "05/2025",
      consumo_ponta_kwh: 8132,
      consumo_fora_ponta_kwh: 59050,
      demanda_ponta_kw: 430,
      demanda_fora_ponta_kw: 447,
      reativo_ponta_kvarh: 824,
      reativo_fora_ponta_kvarh: 4511,
      total_pagar: 55970.04,
      dias_ciclo: 30, // <-- adicionar
      concessionaria: "EQUATORIAL_PARA", // <-- adicionar
      validado: true, // <-- adicionar
    };
    setFaturas([faturaExemplo]);
    localStorage.setItem(
      "dimensionar_faturas",
      JSON.stringify([faturaExemplo]),
    );
  };

  const validarFatura = (
    fatura: Partial<Fatura>,
  ): { valida: boolean; mensagem: string } => {
    const consumoTotal =
      (fatura.consumo_ponta_kwh || 0) + (fatura.consumo_fora_ponta_kwh || 0);
    const reativoTotal =
      (fatura.reativo_ponta_kvarh || 0) +
      (fatura.reativo_fora_ponta_kvarh || 0);

    if (consumoTotal === 0 && reativoTotal === 0) {
      return {
        valida: false,
        mensagem:
          "⚠️ Ambos os valores de consumo e reativo estão zerados. Preencha pelo menos um campo.",
      };
    }

    if (reativoTotal > consumoTotal && consumoTotal > 0) {
      const percentual = (reativoTotal / consumoTotal) * 100;
      if (percentual > 200) {
        return {
          valida: false,
          mensagem: `⚠️ ATENÇÃO: A Energia Reativa (${reativoTotal.toLocaleString()} kVArh) é ${percentual.toFixed(0)}% maior que o Consumo Ativo (${consumoTotal.toLocaleString()} kWh).\n\nIsso geralmente indica que os valores de CONSUMO e REATIVO foram TROCADOS.\n\n✓ Consumo (kWh): valores altos (ex: 8.000 a 80.000)\n✓ Reativo (kVArh): valores baixos (ex: 500 a 5.000)\n\nPor favor, verifique e corrija os dados.`,
        };
      }
    }

    const fp = calcularFP(consumoTotal, reativoTotal);

    if (fp < 0.5 && consumoTotal > 0 && reativoTotal > 0) {
      return {
        valida: false,
        mensagem: `⚠️ ATENÇÃO: O Fator de Potência calculado é ${(fp * 100).toFixed(1)}%, o que é tecnicamente inválido para uma instalação real.\n\n✓ O FP normal fica entre 80% e 99%\n✓ Valores baixos geralmente indicam dados trocados\n✓ Verifique se você inverteu Consumo (kWh) com Reativo (kVArh)`,
      };
    }

    return { valida: true, mensagem: "" };
  };

  const salvarTransformadores = () => {
    try {
      localStorage.setItem(
        "dimensionar_transformadores",
        JSON.stringify(transformadores),
      );
      Swal.fire({
        title: "✅ Sucesso!",
        text: "Configuração dos transformadores salva!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire("Erro", "Não foi possível salvar", "error");
    }
  };

  const salvarFatura = () => {
    if (!currentFatura.mes_referencia) {
      Swal.fire("Atenção", "Informe o mês de referência", "warning");
      return;
    }

    const validacao = validarFatura(currentFatura);
    if (!validacao.valida) {
      Swal.fire({
        title: "Dados inconsistentes",
        html: `<div class="text-left whitespace-pre-line">${validacao.mensagem}</div>`,
        icon: "warning",
        confirmButtonColor: "#e74c3c",
        confirmButtonText: "Entendi, vou corrigir",
      });
      return;
    }

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
      dias_ciclo: parseInt(currentFatura.dias_ciclo) || 30, // ✅ adicionado
      concessionaria: currentFatura.concessionaria, // ✅ adicionado
      validado: Math.abs((fpInf || fpCalc) - fpCalc) < 0.05, // ✅ adicionado
      fp_calculado: fpCalc,
      fp_informado: fpInf,
      reativo_excedente_calculado: calcularReativoExcedente(
        ativoTotal,
        reativoTotal,
      ),
      multa_reativo_calculada: calcularMultaReativa(
        ativoTotal,
        reativoTotal,
        tarifaBase,
      ),
      tarifa_reativo_utilizada: tarifaBase,
    };

    let novasFaturas = [...faturas];
    if (editandoFatura !== null) {
      novasFaturas[editandoFatura] = novaFatura;
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
    setEditandoFatura(null);
    setErroValidacao(null);

    Swal.fire({
      title: "✅ Sucesso!",
      text: "Fatura salva com sucesso!",
      icon: "success",
      timer: 1500,
      showConfirmButton: false,
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
    });
    setErroValidacao(null);
  };

  const removerFatura = (index: number) => {
    Swal.fire({
      title: "Remover fatura?",
      text: "Esta ação não pode ser desfeita.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#e74c3c",
      confirmButtonText: "Remover",
    }).then((result) => {
      if (result.isConfirmed) {
        const novasFaturas = faturas.filter((_, i) => i !== index);
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
    if (transformadores.length > 1) {
      setTransformadores(transformadores.filter((_, i) => i !== index));
    }
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

  const calcularFP = (
    consumoAtivoTotal: number,
    reativoTotal: number,
  ): number => {
    if (consumoAtivoTotal === 0) return 0.8;
    const potenciaAparente = Math.sqrt(
      Math.pow(consumoAtivoTotal, 2) + Math.pow(reativoTotal, 2),
    );
    return consumoAtivoTotal / potenciaAparente;
  };

  const calcularCustoReativo = (
    reativoPonta: number,
    reativoForaPonta: number,
  ): number => {
    return (reativoPonta + reativoForaPonta) * TARIFA_REATIVO;
  };
  const calcularReativoTransformadores = (
    transformadores: Transformador[],
    demandaMediaKw: number,
  ): number => {
    const potenciaTotal = transformadores.reduce(
      (acc, t) => acc + t.potencia_kva * t.quantidade,
      0,
    );

    if (potenciaTotal === 0) return 0;

    // fator de carga real
    const fatorCarga = Math.min(demandaMediaKw / potenciaTotal, 1);

    // % típica de magnetização (ajustável)
    const percentualReativo = 0.015; // 1.5%

    const kvarTotal = potenciaTotal * fatorCarga * percentualReativo;

    return kvarTotal;
  };

  const calcularPotenciaAtivaMedia = (
    consumoTotal: number,
    horasMes: number = 220,
  ): number => {
    return consumoTotal / horasMes;
  };

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
      const alertas: string[] = [];
      let consistenciaData = 100;

      const concessionarias = [
        ...new Set(faturas.map((f) => f.concessionaria)),
      ];
      if (concessionarias.length > 1) {
        alertas.push(
          `⚠️ Faturas de diferentes concessionárias: ${concessionarias.join(", ")}`,
        );
        consistenciaData -= 20;
      }

      const grupoTarifario = potenciaTotalTransformadores >= 75 ? "A" : "B";

      // Processa cada fatura extraindo demanda máxima
      const faturasProcessadas = faturas.map((f) => {
        const ativoTotal = f.consumo_ponta_kwh + f.consumo_fora_ponta_kwh;
        const reativoTotal = f.reativo_ponta_kvarh + f.reativo_fora_ponta_kvarh;
        const fp =
          f.fp_calculado || calcularFatorPotencia(ativoTotal, reativoTotal);
        const tarifa =
          f.tarifa_reativo_utilizada ||
          TARIFAS_REATIVO[f.concessionaria as keyof typeof TARIFAS_REATIVO]
            ?.base ||
          0.28622;
        const multa =
          f.multa_reativo_calculada ||
          calcularMultaReativa(ativoTotal, reativoTotal, tarifa);
        // ✅ CORREÇÃO: demanda máxima entre ponta e fora ponta
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

      // Maior demanda entre todas as faturas
      const demandaMaximaGlobal = Math.max(
        ...faturasProcessadas.map((f) => f.demandaMaxKw),
      );
      // Pior mês (menor FP)
      const piorMes = faturasProcessadas.reduce(
        (prev, curr) => (curr.fp < prev.fp ? curr : prev),
        faturasProcessadas[0],
      );

      const mediaMulta =
        faturasProcessadas.reduce((acc, f) => acc + f.multa, 0) /
        faturasProcessadas.length;

      const precisaCapacitor =
        piorMes.fp < FP_MINIMO_REGULAMENTAR || mediaMulta > 200;
      let motivo = "";
      let totalKvar = 0;
      let stages: number[] = [];
      let economiaMensal = 0;
      let investimento = 0;
      let payback = 0;
      let totalKvarComercial = 0;
      let investimentoComercial = 0;
      let paybackComercial = 0;

      if (precisaCapacitor) {
        motivo = `FP no pior mês (${piorMes.mes_referencia}) = ${(piorMes.fp * 100).toFixed(1)}% - Multa mensal atual: ${formatMoney(mediaMulta)}`;

        totalKvar = calcularKvarNecessario(
          demandaMaximaGlobal,
          piorMes.fp,
          targetFP,
        );
        totalKvar =
          Math.ceil((totalKvar * CONFIG_CAPACITORES.margem_seguranca) / 2.5) *
          2.5;
        totalKvar = Math.max(totalKvar, CONFIG_CAPACITORES.minimo_kvar_grupo_a);

        totalKvarComercial = Math.ceil(totalKvar / 10) * 10;
        stages = distribuirEstagios(totalKvar);

        economiaMensal = mediaMulta * 0.9;
        const custoPorKvar = grupoTarifario === "A" ? 85 : 70;
        investimento = totalKvar * custoPorKvar + 2200;
        investimentoComercial = totalKvarComercial * custoPorKvar + 2200;
        payback =
          economiaMensal > 0 ? Math.ceil(investimento / economiaMensal) : 99;
        paybackComercial =
          economiaMensal > 0
            ? Math.ceil(investimentoComercial / economiaMensal)
            : 99;
      } else {
        const mediaFp =
          faturasProcessadas.reduce((a, b) => a + b.fp, 0) /
          faturasProcessadas.length;
        motivo = `✅ Sistema regularizado (FP médio: ${(mediaFp * 100).toFixed(1)}%)`;
      }

      const investimentoMercadoReal = calcularPrecoMercado(totalKvarComercial);
      const paybackMercadoReal =
        economiaMensal > 0
          ? Math.ceil(investimentoMercadoReal / economiaMensal)
          : 99;
      const economiaAnual = economiaMensal * 12;
      const retorno5Anos = economiaAnual * 5 - investimentoMercadoReal;
      const precoPorKvar = investimentoMercadoReal / totalKvarComercial;

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
        fp_projetado_percent: precisaCapacitor
          ? targetFP * 100
          : piorMes.fp * 100,
        multa_atual_mensal_real: mediaMulta,
        multa_atual_mensal_calculada: mediaMulta,
        consumo_ativo_medio_mensal_kwh:
          faturasProcessadas.reduce((a, b) => a + b.ativoTotal, 0) /
          faturasProcessadas.length,
        consumo_reativo_medio_mensal_kvarh:
          faturasProcessadas.reduce((a, b) => a + b.reativoTotal, 0) /
          faturasProcessadas.length,
        potencia_ativa_media_kw: demandaMaximaGlobal, // <- agora é a demanda máxima
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
        title: precisaCapacitor
          ? "✅ Dimensionamento Concluído"
          : "✅ Análise Concluída",
        html: `
        <div class="text-center">
          <p class="text-lg font-bold">FP no pior mês: ${(piorMes.fp * 100).toFixed(1)}%</p>
          ${precisaCapacitor ? `<p class="text-primary font-bold mt-2">🔋 Recomendação: ${totalKvar.toFixed(1)} kVAr<br/><span class="text-sm">(Comercial: ${totalKvarComercial} kVAr)</span></p>` : '<p class="text-green-600 mt-2">Sistema dentro das normas ANEEL</p>'}
          <p class="text-xs text-slate-500 mt-2">💰 Demanda máxima considerada: ${demandaMaximaGlobal.toFixed(1)} kW</p>
          <p class="text-xs text-slate-500">💰 Investimento mercado: ${formatMoney(investimentoMercadoReal)}</p>
          <p class="text-xs text-slate-500">⏱️ Payback: ${paybackMercadoReal} meses</p>
        </div>
      `,
        icon: precisaCapacitor ? "success" : "info",
        timer: 5000,
      });
    } catch (error) {
      console.error("Erro no cálculo:", error);
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
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      const pdfHeight = (img.height * pdfWidth) / img.width;
      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(
        `Dimensionamento_CapacitorManager_${new Date().toISOString().slice(0, 10)}.pdf`,
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

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-primary">
          Dimensionamento de Banco de Capacitores
        </h1>
        <p className="text-slate-500 mt-2">
          Análise baseada em faturas da RORAIMA ENERGIA
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Infraestrutura: 7x225kVA + 1x75kVA | 220V
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-6">
          {/* Transformadores */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <Package size={20} className="text-secondary" /> Transformadores
              </h2>
              <button
                onClick={salvarTransformadores}
                className="text-xs bg-primary text-white px-3 py-1 rounded-lg hover:bg-primary/90"
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
                    <div className="flex-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase">
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
                        className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                      />
                    </div>
                    <div className="w-20">
                      <label className="text-[8px] font-black text-slate-400 uppercase">
                        Qtd
                      </label>
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
                        className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-[8px] font-black text-slate-400 uppercase">
                        Tensão (V)
                      </label>
                      <input
                        type="number"
                        value={trafo.tensao_v}
                        onChange={(e) =>
                          atualizarTransformador(
                            idx,
                            "tensao_v",
                            parseFloat(e.target.value) || 220,
                          )
                        }
                        className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                      />
                    </div>
                  </div>
                  {transformadores.length > 1 && (
                    <button
                      onClick={() => removerTransformador(idx)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={adicionarTransformador}
                className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold hover:border-secondary hover:text-secondary transition-all flex items-center justify-center gap-2"
              >
                <Plus size={14} /> Adicionar Transformador
              </button>
            </div>
            <div className="mt-4 p-3 bg-primary/5 rounded-xl">
              <div className="flex justify-between text-sm">
                <span>Potência Total Instalada:</span>
                <span className="font-bold text-primary">
                  {potenciaTotalTransformadores.toLocaleString()} kVA
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Configuração:</span>
                <span>
                  {transformadores
                    .map((t) => `${t.quantidade}x${t.potencia_kva}kVA`)
                    .join(" + ")}{" "}
                  | {transformadores[0]?.tensao_v}V
                </span>
              </div>
            </div>
          </div>

          {/* Faturas */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <History size={20} className="text-secondary" /> Faturas (
                {faturas.length})
              </h2>
              <button
                onClick={() => {
                  setCurrentFatura({});
                  setEditandoFatura(null);
                  setShowFaturaModal(true);
                }}
                className="text-xs bg-primary text-white px-3 py-1 rounded-lg hover:bg-primary/90"
              >
                <Plus size={12} /> Adicionar
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {faturas.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p>Nenhuma fatura cadastrada</p>
                  <button
                    onClick={() => {
                      carregarFaturaExemploReal();
                      Swal.fire(
                        "Exemplo carregado!",
                        "Fatura de 05/2025 adicionada",
                        "success",
                      );
                    }}
                    className="mt-2 text-primary text-sm hover:underline"
                  >
                    Carregar fatura exemplo
                  </button>
                </div>
              ) : (
                faturas.map((fat, idx) => {
                  const consumoTotal =
                    fat.consumo_ponta_kwh + fat.consumo_fora_ponta_kwh;
                  const reativoTotal =
                    fat.reativo_ponta_kvarh + fat.reativo_fora_ponta_kvarh;
                  const fp = calcularFP(consumoTotal, reativoTotal);
                  const custoReativo = calcularCustoReativo(
                    fat.reativo_ponta_kvarh,
                    fat.reativo_fora_ponta_kvarh,
                  );
                  const isInvertido =
                    reativoTotal > consumoTotal && consumoTotal > 0;

                  return (
                    <div
                      key={fat.id}
                      className={`p-3 rounded-lg ${isInvertido ? "bg-red-50 border border-red-200" : "bg-slate-50"}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-primary">
                          {fat.mes_referencia}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setCurrentFatura(fat);
                              setEditandoFatura(idx);
                              setShowFaturaModal(true);
                            }}
                            className="text-blue-500 hover:text-blue-700"
                            title="Editar"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => removerFatura(idx)}
                            className="text-red-500 hover:text-red-700"
                            title="Remover"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs mt-2">
                        <div>
                          <span className="text-slate-500">Consumo Ponta:</span>{" "}
                          {fat.consumo_ponta_kwh.toLocaleString()} kWh
                        </div>
                        <div>
                          <span className="text-slate-500">
                            Consumo F/Ponta:
                          </span>{" "}
                          {fat.consumo_fora_ponta_kwh.toLocaleString()} kWh
                        </div>
                        <div>
                          <span className="text-slate-500">Demanda Ponta:</span>{" "}
                          {fat.demanda_ponta_kw} kW
                        </div>
                        <div>
                          <span className="text-slate-500">Reativo Ponta:</span>{" "}
                          {fat.reativo_ponta_kvarh.toLocaleString()} kVArh
                        </div>
                        <div>
                          <span className="text-slate-500">
                            Reativo F/Ponta:
                          </span>{" "}
                          {fat.reativo_fora_ponta_kvarh.toLocaleString()} kVArh
                        </div>
                        <div>
                          <span className="text-slate-500">Total:</span> R${" "}
                          {fat.total_pagar.toLocaleString()}
                        </div>
                        <div className="col-span-2 mt-1 pt-1 border-t border-slate-200">
                          <span
                            className={`text-xs font-bold ${fp >= 0.92 ? "text-green-600" : fp > 0.5 ? "text-amber-600" : "text-red-600"} flex items-center justify-between`}
                          >
                            <span>FP: {(fp * 100).toFixed(1)}%</span>
                            {isInvertido && (
                              <span className="flex items-center gap-1 text-red-500">
                                <AlertCircle size={12} /> Dados invertidos?
                              </span>
                            )}
                            {custoReativo > 50 && (
                              <span>
                                Custo Reativo: R$ {custoReativo.toFixed(2)}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {faturas.length > 0 && (
              <div className="mt-3 text-xs text-center text-slate-400">
                {faturas.length < 3 && (
                  <p className="text-amber-600">
                    ⚠️ Mínimo: 3 faturas para dimensionamento
                  </p>
                )}
                {faturas.length > 12 && (
                  <p className="text-amber-600">
                    ⚠️ Máximo: 12 faturas (use apenas últimas 12)
                  </p>
                )}
                {faturas.length >= 3 && faturas.length <= 12 && (
                  <p className="text-green-600">
                    ✅ {faturas.length} faturas - ok para cálculo
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Parâmetros */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Fator de Potência Desejado
            </label>
            <select
              value={targetFP}
              onChange={(e) => setTargetFP(parseFloat(e.target.value))}
              className="w-full rounded-xl border border-slate-200 p-3 mb-6"
            >
              <option value={0.92}>0.92 (mínimo regulamentar - ANEEL)</option>
              <option value={0.95}>0.95 (recomendado para economia)</option>
              <option value={0.98}>
                0.98 (excelente - maior investimento)
              </option>
            </select>

            <button
              onClick={calcularDimensionamento}
              disabled={calculando || faturas.length < 3 || faturas.length > 12}
              className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {calculando ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <Zap size={20} />
              )}
              Calcular Dimensionamento
            </button>

            {faturas.length < 3 && (
              <p className="text-xs text-amber-600 mt-2 text-center">
                ⚠️ Adicione mais {3 - faturas.length} fatura(s) (mínimo 3)
              </p>
            )}
            {faturas.length > 12 && (
              <p className="text-xs text-amber-600 mt-2 text-center">
                ⚠️ Remova {faturas.length - 12} fatura(s) (máximo 12)
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-7">
          {result ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div
                ref={reportRef}
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100"
              >
                <div className="bg-slate-900 p-6 text-white text-center">
                  <Zap size={32} className="mx-auto text-secondary mb-2" />
                  <h2 className="text-2xl font-black">CapacitorManager</h2>
                  <p className="text-slate-400 text-sm">
                    Memorial de Dimensionamento
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    Gerado em {new Date().toLocaleDateString("pt-BR")}
                  </p>
                </div>

                <div className="p-6 space-y-6">
                  {result.precisaCapacitor ? (
                    <>
                      <div className="text-center border-b pb-4">
                        <p className="text-sm text-slate-500">
                          Potência Total Recomendada
                        </p>
                        <p className="text-5xl font-bold text-primary">
                          {result.totalKvar}{" "}
                          <span className="text-lg">kVAr</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Grupo {result.grupoTarifario} -{" "}
                          {result.quantidadeFaturas} faturas analisadas
                        </p>
                      </div>

                      <div className="bg-blue-50 rounded-xl p-3 mb-4">
                        <p className="text-xs font-bold text-blue-700">
                          📌 {result.motivoRecomendacao}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-red-50 rounded-xl p-3 text-center">
                          <TrendingUp
                            size={20}
                            className="mx-auto text-red-600 mb-1"
                          />
                          <p className="text-xs text-slate-500">
                            FP Médio (geral)
                          </p>
                          <p className="text-2xl font-bold text-red-600">
                            {result.fpAtual.toFixed(1)}%
                          </p>
                        </div>
                        <div className="bg-emerald-50 rounded-xl p-3 text-center">
                          <CheckCircle2
                            size={20}
                            className="mx-auto text-emerald-600 mb-1"
                          />
                          <p className="text-xs text-slate-500">FP Projetado</p>
                          <p className="text-2xl font-bold text-emerald-600">
                            {result.fpProjetado.toFixed(0)}%
                          </p>
                        </div>
                      </div>

                      {result.piorMes && (
                        <div className="bg-amber-50 rounded-xl p-3">
                          <p className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1">
                            <AlertTriangle size={12} /> Pior Mês do Período
                            (apenas informativo)
                          </p>
                          <p className="text-sm font-medium">
                            {result.piorMes.mes_referencia}
                          </p>
                          <p className="text-xs text-amber-600">
                            FP: {(result.piorMes.fp! * 100).toFixed(1)}% | Custo
                            Reativo: R${" "}
                            {calcularCustoReativo(
                              result.piorMes.reativo_ponta_kvarh,
                              result.piorMes.reativo_fora_ponta_kvarh,
                            ).toFixed(2)}
                          </p>
                        </div>
                      )}

                      <div>
                        <h3 className="font-bold text-primary mb-2 flex items-center gap-1">
                          <Layers size={16} /> Distribuição dos Estágios
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {result.stages.map((s, i) => (
                            <div
                              key={i}
                              className="bg-slate-100 rounded-lg px-3 py-2"
                            >
                              <span className="font-bold text-primary">
                                {s} kVAr
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          {result.recomendacaoEstagios}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-red-50 rounded-xl p-4 text-center">
                          <DollarSign
                            size={20}
                            className="mx-auto text-red-600 mb-1"
                          />
                          <p className="text-xs text-slate-500">
                            Custo Mensal com Reativo
                          </p>
                          <p className="text-xl font-bold text-red-600">
                            R$ {result.multaAtual.toFixed(2)}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            valor faturado
                          </p>
                        </div>
                        <div className="bg-green-50 rounded-xl p-4 text-center">
                          <DollarSign
                            size={20}
                            className="mx-auto text-green-600 mb-1"
                          />
                          <p className="text-xs text-slate-500">
                            Economia Mensal Estimada
                          </p>
                          <p className="text-xl font-bold text-green-700">
                            R$ {result.economiaMensal.toFixed(2)}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            após instalação
                          </p>
                        </div>
                      </div>

                      <div className="bg-blue-50 rounded-xl p-4 text-center">
                        <p className="text-sm text-slate-500">
                          ⏱️ Payback Estimado
                        </p>
                        <p className="text-3xl font-bold text-primary">
                          {result.paybackMeses} meses
                        </p>
                        <p className="text-xs text-slate-400">
                          (~{(result.paybackMeses / 12).toFixed(1)} anos)
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                          Investimento estimado: R${" "}
                          {result.investimentoEstimado.toLocaleString()}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-center border-b pb-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3">
                          <CheckCircle2 size={32} className="text-green-600" />
                        </div>
                        <p className="text-xl font-bold text-green-600">
                          Instalação Regularizada
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          Grupo {result.grupoTarifario} -{" "}
                          {result.quantidadeFaturas} faturas analisadas
                        </p>
                      </div>

                      <div className="bg-blue-50 rounded-xl p-3 mb-4">
                        <p className="text-xs font-bold text-blue-700">
                          📌 {result.motivoRecomendacao}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-emerald-50 rounded-xl p-3 text-center">
                          <TrendingUp
                            size={20}
                            className="mx-auto text-emerald-600 mb-1"
                          />
                          <p className="text-xs text-slate-500">
                            FP Médio Atual
                          </p>
                          <p className="text-2xl font-bold text-emerald-600">
                            {result.fpAtual.toFixed(1)}%
                          </p>
                        </div>
                        <div className="bg-emerald-50 rounded-xl p-3 text-center">
                          <DollarSign
                            size={20}
                            className="mx-auto text-emerald-600 mb-1"
                          />
                          <p className="text-xs text-slate-500">
                            Custo Reativo Médio
                          </p>
                          <p className="text-xl font-bold text-emerald-600">
                            R$ {result.custoReativoMensal.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="bg-green-50 rounded-xl p-4 text-center">
                        <p className="text-sm text-slate-600">
                          ✅ {result.recomendacaoEstagios}
                        </p>
                      </div>
                    </>
                  )}

                  <div className="bg-slate-50 rounded-xl p-4 mt-2">
                    <h4 className="font-bold text-primary text-sm mb-2">
                      📋 Especificações Técnicas
                    </h4>
                    <div className="text-xs space-y-1 text-slate-600">
                      <p>
                        {/* Demanda máxima considerada */}
                        <div className="mb-3 p-2 bg-blue-50 rounded-lg text-xs text-blue-800">
                          📊 Demanda ativa máxima considerada:{" "}
                          <strong>
                            {result.potencia_ativa_media_kw.toFixed(1)} kW
                          </strong>
                          <span className="block text-[10px] text-blue-600 mt-0.5">
                            (baseada na maior demanda registrada nas faturas –
                            ponta ou fora ponta)
                          </span>
                        </div>
                        • Tensão dos capacitores: 440V / 480V (ligação
                        triângulo)
                      </p>
                      <p>• Controlador automático de fator de potência</p>
                      <p>• Reatores de 5% a 7% (se houver harmônicos)</p>
                      <p>• Banco automático tipo rack ou painel</p>
                      <p>• Instalação no secundário do transformador ou QGBT</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={exportMemorial}
                  className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  <Printer size={18} /> Exportar PDF
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <Calculator size={64} className="text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-500">
                Aguardando Dados
              </h3>
              <p className="text-sm text-slate-400 mt-2 max-w-md">
                Configure os transformadores, adicione{" "}
                <strong>3 a 12 faturas</strong> e clique em "Calcular
                Dimensionamento"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showFaturaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-primary">
                  {editandoFatura !== null
                    ? "✏️ Editar Fatura"
                    : "➕ Nova Fatura"}
                </h3>
                <button
                  onClick={() => setShowFaturaModal(false)}
                  className="p-1 hover:bg-slate-100 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">
                    Mês/Ano <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 05/2025"
                    value={currentFatura.mes_referencia || ""}
                    onChange={(e) =>
                      setCurrentFatura({
                        ...currentFatura,
                        mes_referencia: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border p-2"
                  />
                </div>

                <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800">
                  <p className="font-bold mb-1">
                    📌 Como preencher corretamente:
                  </p>
                  <p>
                    • <strong>Consumo (kWh):</strong> valores altos (ex: 8.000 a
                    80.000)
                  </p>
                  <p>
                    • <strong>Reativo (kVArh):</strong> valores baixos (ex: 500
                    a 5.000)
                  </p>
                  <p>• O Fator de Potência ideal deve ficar entre 80% e 99%</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium">
                      Consumo Ponta (kWh)
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 8132"
                      value={currentFatura.consumo_ponta_kwh || ""}
                      onChange={(e) =>
                        setCurrentFatura({
                          ...currentFatura,
                          consumo_ponta_kwh: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-lg border p-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">
                      Consumo Fora Ponta (kWh)
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 59050"
                      value={currentFatura.consumo_fora_ponta_kwh || ""}
                      onChange={(e) =>
                        setCurrentFatura({
                          ...currentFatura,
                          consumo_fora_ponta_kwh:
                            parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-lg border p-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium">
                      Demanda Ponta (kW)
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 430"
                      value={currentFatura.demanda_ponta_kw || ""}
                      onChange={(e) =>
                        setCurrentFatura({
                          ...currentFatura,
                          demanda_ponta_kw: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-lg border p-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">
                      Demanda Fora Ponta (kW)
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 447"
                      value={currentFatura.demanda_fora_ponta_kw || ""}
                      onChange={(e) =>
                        setCurrentFatura({
                          ...currentFatura,
                          demanda_fora_ponta_kw:
                            parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-lg border p-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium">
                      Reativo Ponta (kVArh)
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 824"
                      value={currentFatura.reativo_ponta_kvarh || ""}
                      onChange={(e) =>
                        setCurrentFatura({
                          ...currentFatura,
                          reativo_ponta_kvarh: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-lg border p-2"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">
                      Reativo Fora Ponta (kVArh)
                    </label>
                    <input
                      type="number"
                      placeholder="Ex: 4511"
                      value={currentFatura.reativo_fora_ponta_kvarh || ""}
                      onChange={(e) =>
                        setCurrentFatura({
                          ...currentFatura,
                          reativo_fora_ponta_kvarh:
                            parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full rounded-lg border p-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium">
                    Total a Pagar (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 55970.04"
                    value={currentFatura.total_pagar || ""}
                    onChange={(e) =>
                      setCurrentFatura({
                        ...currentFatura,
                        total_pagar: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-lg border p-2"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={carregarFaturaExemplo}
                  className="flex-1 py-2 border rounded-lg text-primary border-primary/30 hover:bg-primary/5 text-sm"
                >
                  Carregar Exemplo (05/2025)
                </button>
                <button
                  onClick={salvarFatura}
                  className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  Salvar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
