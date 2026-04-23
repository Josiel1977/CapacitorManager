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
  fp?: number;
  multa_reativa?: number;
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
      id: Date.now().toString(),
      mes_referencia: currentFatura.mes_referencia,
      consumo_ponta_kwh: currentFatura.consumo_ponta_kwh || 0,
      consumo_fora_ponta_kwh: currentFatura.consumo_fora_ponta_kwh || 0,
      demanda_ponta_kw: currentFatura.demanda_ponta_kw || 0,
      demanda_fora_ponta_kw: currentFatura.demanda_fora_ponta_kw || 0,
      reativo_ponta_kvarh: currentFatura.reativo_ponta_kvarh || 0,
      reativo_fora_ponta_kvarh: currentFatura.reativo_fora_ponta_kvarh || 0,
      total_pagar: currentFatura.total_pagar || 0,
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
    if (faturas.length < 3) {
      Swal.fire({
        title: "⚠️ Faturas Insuficientes",
        html: `<div class="text-left">
          <p>O dimensionamento profissional requer <strong>no mínimo 3 faturas</strong> para análise estatística.</p>
          <p class="mt-2">Atualmente: <strong>${faturas.length} fatura(s)</strong></p>
          <p class="mt-2 text-sm text-slate-500">Recomendado: 6 a 12 faturas dos últimos 12 meses.</p>
        </div>`,
        icon: "warning",
        confirmButtonColor: "#0a2b3c",
      });
      return;
    }

    if (faturas.length > 12) {
      Swal.fire({
        title: "⚠️ Muitas Faturas",
        html: `<div class="text-left">
          <p>Para dimensionamento, utilize no <strong>máximo 12 faturas</strong> (últimos 12 meses).</p>
          <p class="mt-2">Atualmente: <strong>${faturas.length} faturas</strong></p>
          <p class="mt-2 text-sm text-slate-500">Faturas mais antigas podem distorcer a análise do perfil atual.</p>
        </div>`,
        icon: "warning",
        confirmButtonColor: "#0a2b3c",
      });
      return;
    }

    setCalculando(true);

    try {
      // IDENTIFICAR GRUPO TARIFÁRIO
      const potenciaTotal = potenciaTotalTransformadores;
      const grupoTarifario: "A" | "B" = potenciaTotal >= 75 ? "A" : "B";

      const faturasProcessadas = faturas.map((f) => {
        const consumoTotal = f.consumo_ponta_kwh + f.consumo_fora_ponta_kwh;
        const reativoTotal = f.reativo_ponta_kvarh + f.reativo_fora_ponta_kvarh;
        const fp = calcularFP(consumoTotal, reativoTotal);
        const custoReativo = calcularCustoReativo(
          f.reativo_ponta_kvarh,
          f.reativo_fora_ponta_kvarh,
        );
        const potenciaMedia = calcularPotenciaAtivaMedia(consumoTotal);

        return {
          ...f,
          fp,
          custoReativo,
          consumoTotal,
          reativoTotal,
          potenciaMedia,
        };
      });

      const totalFaturas = faturasProcessadas.length;

      const somaPotenciaAtiva = faturasProcessadas.reduce(
        (acc, f) => acc + f.potenciaMedia,
        0,
      );
      const somaFP = faturasProcessadas.reduce((acc, f) => acc + f.fp, 0);
      const somaConsumo = faturasProcessadas.reduce(
        (acc, f) => acc + f.consumoTotal,
        0,
      );
      const somaCustoReativo = faturasProcessadas.reduce(
        (acc, f) => acc + f.custoReativo,
        0,
      );

      const mediaPotenciaAtiva = somaPotenciaAtiva / totalFaturas;
      const mediaFP = somaFP / totalFaturas;
      const mediaConsumo = somaConsumo / totalFaturas;
      const mediaCustoReativo = somaCustoReativo / totalFaturas;

      const piorMes = [...faturasProcessadas].sort((a, b) => a.fp - b.fp)[0];

      // LÓGICA BASEADA NO GRUPO TARIFÁRIO
      let precisaCapacitor = false;
      let motivo = "";
      let totalKvar = 0;
      let stages: number[] = [];
      let economiaMensal = 0;
      let investimentoEstimado = 0;
      let paybackMeses = 0;
      let recomendacaoEstagios = "";

      if (grupoTarifario === "A") {
        // GRUPO A: SEMPRE precisa de capacitor se paga reativo
        precisaCapacitor = mediaCustoReativo > 50;
        motivo = `Grupo A (Alta Tensão) - Todo reativo excedente é faturado. Custo médio mensal: R$ ${mediaCustoReativo.toFixed(2)}`;

        if (precisaCapacitor) {
          const phi1 = Math.acos(Math.min(0.99, mediaFP));
          const phi2 = Math.acos(targetFP);

          const kvarProcesso =
            mediaPotenciaAtiva * (Math.tan(phi1) - Math.tan(phi2));
          const kvarTrafo = calcularReativoTransformadores(
            transformadores,
            mediaPotenciaAtiva,
          );

          totalKvar = Math.ceil((kvarProcesso + kvarTrafo) / 5) * 5;
          totalKvar = Math.max(totalKvar, 30);

          let restante = totalKvar;

          const qtdTrafo225 = transformadores
            .filter((t) => t.potencia_kva === 225)
            .reduce((acc, t) => acc + t.quantidade, 0);

          for (let i = 0; i < qtdTrafo225 && restante >= 60; i++) {
            stages.push(60);
            restante -= 60;
          }

          if (restante >= 30) {
            stages.push(30);
            restante -= 30;
          }

          const sizes = [20, 15, 10, 5];
          for (const size of sizes) {
            while (restante >= size) {
              stages.push(size);
              restante -= size;
            }
          }

          stages.sort((a, b) => a - b);

          recomendacaoEstagios = `Recomendado: 1 banco central de ${totalKvar} kVAr ou ${stages.length} estágios (${stages.filter((s) => s === 60).length}x60kVAr + complementos)`;

          economiaMensal = mediaCustoReativo * 0.95;
          investimentoEstimado = totalKvar * 89.9 + 2500;
          paybackMeses =
            economiaMensal > 0
              ? Math.ceil(investimentoEstimado / economiaMensal)
              : 0;
        } else {
          recomendacaoEstagios = `✅ Seu custo com reativo é baixo (R$ ${mediaCustoReativo.toFixed(2)}/mês). Não há necessidade de investimento no momento.`;
        }
      } else {
        // GRUPO B: só precisa se FP < 92%
        precisaCapacitor = mediaFP < 0.92;
        motivo = precisaCapacitor
          ? `FP abaixo do regulamentar (${(mediaFP * 100).toFixed(1)}% < 92%)`
          : "FP dentro do regulamentar";

        if (precisaCapacitor) {
          const phi1 = Math.acos(Math.min(0.99, mediaFP));
          const phi2 = Math.acos(targetFP);

          const kvarProcesso =
            mediaPotenciaAtiva * (Math.tan(phi1) - Math.tan(phi2));
          const kvarTrafo = calcularReativoTransformadores(
            transformadores,
            mediaPotenciaAtiva,
          );

          totalKvar = Math.ceil((kvarProcesso + kvarTrafo) / 5) * 5;
          totalKvar = Math.max(totalKvar, 30);

          let restante = totalKvar;
          const sizes = [30, 20, 15, 10, 5];
          for (const size of sizes) {
            while (restante >= size) {
              stages.push(size);
              restante -= size;
            }
          }
          stages.sort((a, b) => a - b);

          recomendacaoEstagios = `Banco automático com ${stages.length} estágios: ${stages.join(" + ")} kVAr`;
          economiaMensal = mediaCustoReativo * 0.95;
          investimentoEstimado = totalKvar * 89.9 + 2000;
          paybackMeses =
            economiaMensal > 0
              ? Math.ceil(investimentoEstimado / economiaMensal)
              : 0;
        } else {
          recomendacaoEstagios =
            "✅ Seu fator de potência já está dentro do regulamentar (FP ≥ 92%). Não há necessidade de investimento em banco de capacitores no momento.";
        }
      }

      setResult({
        totalKvar,
        stages,
        economiaMensal,
        investimentoEstimado,
        paybackMeses,
        fpAtual: mediaFP * 100,
        fpProjetado: precisaCapacitor ? targetFP * 100 : mediaFP * 100,
        multaAtual: mediaCustoReativo,
        consumoTotalMedio: mediaConsumo,
        potenciaAtivaMediaKw: mediaPotenciaAtiva,
        piorMes,
        recomendacaoEstagios,
        quantidadeFaturas: totalFaturas,
        precisaCapacitor,
        grupoTarifario,
        motivoRecomendacao: motivo,
        custoReativoMensal: mediaCustoReativo,
      });

      let mensagem = "";
      if (precisaCapacitor) {
        mensagem = `<div class="text-left">
          <p><strong>📊 Análise de ${totalFaturas} faturas</strong> (mín:3 | máx:12)</p>
          <p>🏭 Grupo Tarifário: <strong>${grupoTarifario}</strong> (${grupoTarifario === "A" ? "Alta Tensão - reativo é cobrado" : "Baixa Tensão"})</p>
          <p>⚡ FP médio geral: ${(mediaFP * 100).toFixed(1)}%</p>
          <p class="text-red-600">⚠️ Custo mensal com reativo: <strong>R$ ${mediaCustoReativo.toFixed(2)}</strong></p>
          <hr class="my-3">
          <p><strong>🎯 Banco de capacitores: ${totalKvar} kVAr</strong></p>
          <p><strong>📦 Estágios: ${stages.length}</strong></p>
          <p><strong>💰 Economia mensal: R$ ${economiaMensal.toFixed(2)}</strong></p>
          <p><strong>⏱️ Payback: ${paybackMeses} meses (${(paybackMeses / 12).toFixed(1)} anos)</strong></p>
          <p class="text-sm text-slate-500 mt-2">💡 Investimento estimado: R$ ${investimentoEstimado.toLocaleString()}</p>
        </div>`;
      } else {
        mensagem = `<div class="text-left">
          <p><strong>📊 Análise de ${totalFaturas} faturas</strong></p>
          <p>🏭 Grupo Tarifário: <strong>${grupoTarifario}</strong></p>
          <p>⚡ FP médio geral: ${(mediaFP * 100).toFixed(1)}%</p>
          <p>💰 Custo médio mensal com reativo: R$ ${mediaCustoReativo.toFixed(2)}</p>
          <p class="text-green-600">✅ ${motivo}</p>
          <hr class="my-3">
          <p><strong>✅ Não há necessidade de investimento no momento</strong></p>
        </div>`;
      }

      Swal.fire({
        title: precisaCapacitor
          ? "✅ Dimensionamento Concluído!"
          : "✅ Análise Concluída!",
        html: mensagem,
        icon: precisaCapacitor ? "success" : "info",
        confirmButtonColor: "#0a2b3c",
      });
    } catch (error) {
      console.error(error);
      Swal.fire("Erro", "Erro ao calcular dimensionamento", "error");
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
