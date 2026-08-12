"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Factory, FileUp, Loader2, Plus, RefreshCw, Save, ShieldCheck } from "lucide-react";
import Swal from "sweetalert2";
import { supabase } from "@/lib/supabase";
import { analyzeTransformerMeasurements } from "@/lib/transformer-measurement-analysis";
import { parseEmbrasulReport } from "@/lib/embrasul-report-parser";
import { reconstructPdfText } from "@/lib/equatorial-invoice-parser";
import { recommendCapacitorBank, type RecommendationMode } from "@/lib/capacitor-recommendation";
import { parseEmbrasulSeriesText } from "@/lib/embrasul-series-parser";

interface Transformer {
  id: string;
  potencia_kva: number;
  quantidade: number | null;
  tensao_v: number | null;
}

interface Measurement {
  id: string;
  measured_at: string;
  interval_minutes: number | null;
  active_power_kw: number | null;
  reactive_power_kvar: number | null;
  apparent_power_kva: number | null;
  power_factor: number | null;
  voltage_v: number | null;
  current_a: number | null;
  thdv_percent: number | null;
  thdi_percent: number | null;
  source: string;
  source_device: string | null;
  notes: string | null;
}

const localDateTime = () => {
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return now.toISOString().slice(0, 16);
};

const emptyForm = () => ({
  measured_at: localDateTime(), interval_minutes: "15", active_power_kw: "", reactive_power_kvar: "",
  apparent_power_kva: "", power_factor: "", voltage_v: "", current_a: "", thdv_percent: "", thdi_percent: "",
  source: "manual", source_device: "", notes: "",
});

const emptyTransformerForm = () => ({ potencia_kva: "150", quantidade: "1", tensao_v: "380" });

const numberOrNull = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const fmt = (value: number | null, digits = 1) => value == null ? "—" : value.toLocaleString("pt-BR", { maximumFractionDigits: digits });

export default function TransformerMeasurementsPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [transformers, setTransformers] = useState<Transformer[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingSeries, setImportingSeries] = useState(false);
  const [fixedCapacitorConnected, setFixedCapacitorConnected] = useState(true);
  const [fixedCapacitorKvar, setFixedCapacitorKvar] = useState("5");
  const [transformerForm, setTransformerForm] = useState(emptyTransformerForm);
  const [savingTransformer, setSavingTransformer] = useState(false);
  const [recommendationMode, setRecommendationMode] = useState<RecommendationMode>("otimizar_existente");
  const [targetPowerFactor, setTargetPowerFactor] = useState("0.92");
  const [installedBankKvar, setInstalledBankKvar] = useState("5");
  const [error, setError] = useState<string | null>(null);

  const selected = transformers.find((item) => item.id === selectedId) ?? null;
  const selectedTotalKva = Number(selected?.potencia_kva ?? 0) * Math.max(1, Number(selected?.quantidade ?? 1));

  useEffect(() => {
    if (!selected) return;
    setTransformerForm({
      potencia_kva: String(selected.potencia_kva),
      quantidade: String(Math.max(1, selected.quantidade ?? 1)),
      tensao_v: selected.tensao_v == null ? "" : String(selected.tensao_v),
    });
  }, [selected]);

  const loadMeasurements = useCallback(async (transformerId: string) => {
    if (!transformerId) { setMeasurements([]); return; }
    const { data, error: queryError } = await supabase
      .from("transformer_load_measurements")
      .select("id, measured_at, interval_minutes, active_power_kw, reactive_power_kvar, apparent_power_kva, power_factor, voltage_v, current_a, thdv_percent, thdi_percent, source, source_device, notes")
      .eq("transformer_id", transformerId)
      .order("measured_at", { ascending: false })
      .limit(5000);
    if (queryError) throw queryError;
    setMeasurements((data ?? []) as Measurement[]);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) throw new Error("Sessão não encontrada. Faça login novamente.");
        const { data: profile, error: profileError } = await supabase
          .from("profiles").select("tenant_id").eq("id", authData.user.id).single();
        if (profileError || !profile?.tenant_id) throw new Error("Usuário sem empresa vinculada.");
        setTenantId(profile.tenant_id);
        const { data, error: transformerError } = await supabase
          .from("transformadores")
          .select("id, potencia_kva, quantidade, tensao_v")
          .eq("tenant_id", profile.tenant_id)
          .order("potencia_kva", { ascending: true });
        if (transformerError) throw transformerError;
        const rows = (data ?? []) as Transformer[];
        setTransformers(rows);
        if (rows[0]) setSelectedId(rows[0].id);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Falha ao carregar os transformadores.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    loadMeasurements(selectedId).catch((cause) => setError(cause instanceof Error ? cause.message : "Falha ao carregar medições."));
  }, [selectedId, loadMeasurements]);

  const saveTransformer = async (createNew = false) => {
    if (!tenantId) return;
    const potencia = numberOrNull(transformerForm.potencia_kva);
    const quantidade = Math.trunc(numberOrNull(transformerForm.quantidade) ?? 0);
    const tensao = numberOrNull(transformerForm.tensao_v);
    if (potencia == null || potencia <= 0 || quantidade < 1 || tensao == null || tensao <= 0) {
      await Swal.fire("Dados inválidos", "Informe potência por unidade, quantidade e tensão maiores que zero.", "warning");
      return;
    }
    try {
      setSavingTransformer(true);
      const payload = {
        ...(createNew ? {} : { id: selectedId }),
        tenant_id: tenantId,
        potencia_kva: potencia,
        quantidade,
        tensao_v: tensao,
        horas_trabalho: 220,
      };
      const { data, error: saveError } = await supabase
        .from("transformadores")
        .upsert(payload)
        .select("id, potencia_kva, quantidade, tensao_v")
        .single();
      if (saveError) throw saveError;
      const saved = data as Transformer;
      setTransformers((current) => createNew
        ? [...current, saved]
        : current.map((item) => item.id === saved.id ? saved : item));
      setSelectedId(saved.id);
      await Swal.fire(
        createNew ? "Transformador adicionado" : "Transformador atualizado",
        `${quantidade} × ${potencia} kVA = ${quantidade * potencia} kVA em ${tensao} V.`,
        "success",
      );
    } catch (cause) {
      await Swal.fire("Não foi possível salvar", cause instanceof Error ? cause.message : "Verifique os dados e tente novamente.", "error");
    } finally {
      setSavingTransformer(false);
    }
  };

  const analysis = useMemo(() => analyzeTransformerMeasurements(
    selectedTotalKva,
    measurements.map((item) => ({
      apparentPowerKva: item.apparent_power_kva,
      activePowerKw: item.active_power_kw,
      reactivePowerKvar: item.reactive_power_kvar,
      powerFactor: item.power_factor,
      thdvPercent: item.thdv_percent,
      thdiPercent: item.thdi_percent,
    })),
  ), [measurements, selectedTotalKva]);

  const parsedTargetPowerFactor = numberOrNull(targetPowerFactor);
  const safeTargetPowerFactor = parsedTargetPowerFactor != null && parsedTargetPowerFactor >= 0.92 && parsedTargetPowerFactor < 1
    ? parsedTargetPowerFactor
    : 0.92;
  const recommendation = useMemo(() => recommendCapacitorBank({
    mode: recommendationMode,
    targetPowerFactor: safeTargetPowerFactor,
    transformerKva: selectedTotalKva,
    samples: measurements.map((item) => ({
      timestamp: item.measured_at,
      activePowerKw: item.active_power_kw ?? 0,
      reactivePowerKvar: item.reactive_power_kvar ?? 0,
      powerFactor: item.power_factor,
      thdvPercent: item.thdv_percent,
      thdiPercent: item.thdi_percent,
    })),
    existingBank: recommendationMode === "otimizar_existente" ? {
      totalKvar: numberOrNull(installedBankKvar) ?? 0,
      fixedKvar: fixedCapacitorConnected ? numberOrNull(fixedCapacitorKvar) ?? 0 : 0,
    } : undefined,
  }), [measurements, recommendationMode, safeTargetPowerFactor, selectedTotalKva, installedBankKvar, fixedCapacitorConnected, fixedCapacitorKvar]);

  const saveMeasurement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !selectedId) return;
    const p = numberOrNull(form.active_power_kw);
    const q = numberOrNull(form.reactive_power_kvar);
    const s = numberOrNull(form.apparent_power_kva);
    const fp = numberOrNull(form.power_factor);
    if (s == null && (p == null || q == null)) {
      await Swal.fire("Dados insuficientes", "Informe S (kVA) ou o par P (kW) e Q (kVAr).", "warning");
      return;
    }
    if (fp != null && (fp === 0 || Math.abs(fp) > 1)) {
      await Swal.fire("Fator de potência inválido", "Use um valor entre -1 e 1, diferente de zero. Valor negativo indica capacitivo.", "warning");
      return;
    }
    const calculatedS = s ?? (p != null && q != null ? Math.sqrt(p ** 2 + q ** 2) : null);
    const calculatedFp = fp ?? (p != null && calculatedS != null && calculatedS > 0
      ? Math.min(1, Math.abs(p) / calculatedS)
      : null);
    try {
      setSaving(true);
      const { error: insertError } = await supabase.from("transformer_load_measurements").insert({
        tenant_id: tenantId,
        transformer_id: selectedId,
        measured_at: new Date(form.measured_at).toISOString(),
        interval_minutes: numberOrNull(form.interval_minutes),
        active_power_kw: p,
        reactive_power_kvar: q,
        apparent_power_kva: calculatedS,
        power_factor: calculatedFp,
        voltage_v: numberOrNull(form.voltage_v),
        current_a: numberOrNull(form.current_a),
        thdv_percent: numberOrNull(form.thdv_percent),
        thdi_percent: numberOrNull(form.thdi_percent),
        source: form.source,
        source_device: form.source_device.trim() || null,
        notes: form.notes.trim() || null,
      });
      if (insertError) throw insertError;
      setForm(emptyForm());
      await loadMeasurements(selectedId);
      await Swal.fire("Medição registrada", "O diagnóstico foi recalculado com rastreabilidade.", "success");
    } catch (cause) {
      await Swal.fire("Não foi possível salvar", cause instanceof Error ? cause.message : "Verifique os dados e tente novamente.", "error");
    } finally {
      setSaving(false);
    }
  };

  const importEmbrasulPdf = async (file?: File) => {
    if (!file || !tenantId || !selectedId) return;
    try {
      setImporting(true);
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      let text = "";
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        text += reconstructPdfText(content.items as any[]) + "\n";
      }
      const parsed = parseEmbrasulReport(text, {
        fixedCapacitorConnected,
        fixedCapacitorKvar: numberOrNull(fixedCapacitorKvar),
      });
      if (parsed.confidence === "insuficiente" || parsed.averageActivePowerKw == null || parsed.averageReactivePowerKvar == null) {
        throw new Error("O relatório não contém P, Q e S médios em um formato Embrasul reconhecido.");
      }
      const confirm = await Swal.fire({
        title: "Relatório Embrasul identificado",
        html: `<div class="text-left text-sm">
          <p><b>Analisador:</b> ${parsed.analyzer} · NS ${parsed.serialNumber ?? "não identificado"}</p>
          <p><b>Integração:</b> ${parsed.integrationMinutes ?? "—"} min</p>
          <p><b>P/Q/S:</b> ${parsed.averageActivePowerKw} kW / ${parsed.averageReactivePowerKvar} kVAr / ${parsed.averageApparentPowerKva ?? "—"} kVA</p>
          <p><b>FP:</b> ${parsed.averagePowerFactor ?? "—"} (${parsed.reactiveBehavior})</p>
          <p><b>Capacitor fixo:</b> ${fixedCapacitorConnected ? `ligado (${fixedCapacitorKvar || "?"} kVAr)` : "desligado"}</p>
          <hr class="my-2"/>${parsed.alerts.map((alert) => `<p>⚠️ ${alert}</p>`).join("")}
        </div>`,
        icon: parsed.reactiveBehavior === "capacitivo" ? "warning" : "info",
        showCancelButton: true,
        confirmButtonText: "Importar medição média",
        cancelButtonText: "Cancelar",
      });
      if (!confirm.isConfirmed) return;
      const { error: insertError } = await supabase.from("transformer_load_measurements").insert({
        tenant_id: tenantId,
        transformer_id: selectedId,
        measured_at: parsed.endedAt ?? new Date().toISOString(),
        interval_minutes: parsed.integrationMinutes,
        active_power_kw: parsed.averageActivePowerKw,
        reactive_power_kvar: parsed.averageReactivePowerKvar,
        apparent_power_kva: parsed.averageApparentPowerKva,
        power_factor: parsed.averagePowerFactor,
        voltage_v: parsed.averagePhaseVoltageV,
        current_a: parsed.averagePhaseCurrentA,
        source: "analisador",
        source_device: `${parsed.analyzer} NS:${parsed.serialNumber ?? "?"}`,
        notes: `Importado de ${file.name}. Capacitor fixo ${fixedCapacitorConnected ? `ligado (${fixedCapacitorKvar || "?"} kVAr)` : "desligado"}. Parser Embrasul. ${parsed.alerts.join(" ")}`,
      });
      if (insertError) throw insertError;
      await loadMeasurements(selectedId);
      await Swal.fire("Relatório importado", "A medição média foi registrada com o contexto do capacitor fixo.", "success");
    } catch (cause) {
      await Swal.fire("Falha na importação", cause instanceof Error ? cause.message : "Não foi possível interpretar o relatório.", "error");
    } finally {
      setImporting(false);
    }
  };

  const importEmbrasulSeries = async (file?: File) => {
    if (!file || !tenantId || !selectedId) return;
    try {
      setImportingSeries(true);
      const bytes = await file.arrayBuffer();
      const utf8 = new TextDecoder("utf-8").decode(bytes);
      const text = utf8.includes("�") ? new TextDecoder("windows-1252").decode(bytes) : utf8;
      const series = parseEmbrasulSeriesText(text);
      if (!series.measurements.length) throw new Error(series.warnings[0] ?? "Nenhuma medição válida foi reconhecida.");
      const mapped = Object.entries(series.mappedColumns).filter(([, value]) => value).map(([field, value]) => `${field}: ${value}`).join(" · ");
      const confirm = await Swal.fire({
        title: "Série temporal reconhecida",
        html: `<div class="text-left text-sm">
          <p><b>Arquivo:</b> ${file.name}</p>
          <p><b>Linhas:</b> ${series.rowsRead} lidas · ${series.measurements.length} válidas · ${series.rejectedRows.length} rejeitadas</p>
          <p><b>Período:</b> ${series.startedAt ? new Date(series.startedAt).toLocaleString("pt-BR") : "—"} até ${series.endedAt ? new Date(series.endedAt).toLocaleString("pt-BR") : "—"}</p>
          <p><b>Integração estimada:</b> ${series.intervalMinutes ?? "—"} min</p>
          <p><b>Amostras capacitivas:</b> ${series.capacitiveSamples}</p>
          <p class="mt-2 text-xs"><b>Colunas:</b> ${mapped}</p>
          <hr class="my-2"/>${series.warnings.map((warning) => `<p>⚠️ ${warning}</p>`).join("")}
        </div>`,
        icon: series.rejectedRows.length || series.warnings.length ? "warning" : "info",
        showCancelButton: true,
        confirmButtonText: `Importar ${series.measurements.length} amostras`,
        cancelButtonText: "Cancelar",
      });
      if (!confirm.isConfirmed) return;
      const notes = `Série Embrasul ${file.name}. Capacitor fixo ${fixedCapacitorConnected ? `ligado (${fixedCapacitorKvar || "?"} kVAr)` : "desligado"}. Parser v${series.version}.`;
      const records = series.measurements.map((item) => ({
        tenant_id: tenantId,
        transformer_id: selectedId,
        measured_at: item.measuredAt,
        interval_minutes: series.intervalMinutes == null ? null : Math.round(series.intervalMinutes),
        active_power_kw: item.activePowerKw,
        reactive_power_kvar: item.reactivePowerKvar,
        apparent_power_kva: item.apparentPowerKva,
        power_factor: item.powerFactor,
        voltage_v: item.voltageV,
        current_a: item.currentA,
        thdv_percent: item.thdvPercent,
        thdi_percent: item.thdiPercent,
        source: "analisador",
        source_device: "EMBRASUL — série temporal",
        notes,
      }));
      const { error: insertError } = await supabase.from("transformer_load_measurements").insert(records);
      if (insertError) throw insertError;
      await loadMeasurements(selectedId);
      await Swal.fire("Série importada", `${records.length} amostras foram vinculadas ao transformador selecionado. A recomendação foi recalculada.`, "success");
    } catch (cause) {
      await Swal.fire("Falha na importação da série", cause instanceof Error ? cause.message : "Não foi possível interpretar o arquivo.", "error");
    } finally {
      setImportingSeries(false);
    }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" size={36} /></div>;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header>
        <div className="flex items-center gap-3"><Factory className="text-primary" size={30} /><h1 className="text-2xl font-bold text-slate-900">Medições dos transformadores</h1></div>
        <p className="mt-2 text-sm text-slate-600">Registre carga, fator de potência e harmônicos antes de confirmar o banco de capacitores.</p>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {!transformers.length ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-bold text-amber-950">Cadastre o transformador antes de importar o analisador</h2>
          <p className="mt-1 text-sm text-amber-800">Informe uma unidade ou um conjunto de transformadores iguais. A potência total será calculada automaticamente.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <label className="text-sm"><span className="mb-1 block font-medium">Potência por unidade (kVA)</span><input inputMode="decimal" value={transformerForm.potencia_kva} onChange={(e) => setTransformerForm({ ...transformerForm, potencia_kva: e.target.value })} className="input" /></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Quantidade</span><input inputMode="numeric" value={transformerForm.quantidade} onChange={(e) => setTransformerForm({ ...transformerForm, quantidade: e.target.value })} className="input" /></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Tensão (V)</span><input inputMode="decimal" value={transformerForm.tensao_v} onChange={(e) => setTransformerForm({ ...transformerForm, tensao_v: e.target.value })} className="input" /></label>
            <button type="button" disabled={savingTransformer} onClick={() => void saveTransformer(true)} className="flex items-center justify-center gap-2 self-end rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{savingTransformer ? <Loader2 className="animate-spin" size={17} /> : <Plus size={17} />} Cadastrar e analisar</button>
          </div>
        </section>
      ) : (
        <>
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <label className="block flex-1 text-sm font-semibold text-slate-700">Transformador ou conjunto analisado
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2 md:max-w-xl">
                  {transformers.map((item, index) => <option key={item.id} value={item.id}>T{index + 1} — {Math.max(1, item.quantidade ?? 1)} × {item.potencia_kva} kVA = {Math.max(1, item.quantidade ?? 1) * item.potencia_kva} kVA{item.tensao_v ? ` / ${item.tensao_v} V` : ""}</option>)}
                </select>
              </label>
              <p className="text-sm font-semibold text-primary">Capacidade analisada: {fmt(selectedTotalKva)} kVA</p>
            </div>
            <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-5">
              <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Potência por unidade (kVA)</span><input inputMode="decimal" value={transformerForm.potencia_kva} onChange={(e) => setTransformerForm({ ...transformerForm, potencia_kva: e.target.value })} className="input" /></label>
              <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Quantidade</span><input inputMode="numeric" value={transformerForm.quantidade} onChange={(e) => setTransformerForm({ ...transformerForm, quantidade: e.target.value })} className="input" /></label>
              <label className="text-sm"><span className="mb-1 block font-medium text-slate-700">Tensão (V)</span><input inputMode="decimal" value={transformerForm.tensao_v} onChange={(e) => setTransformerForm({ ...transformerForm, tensao_v: e.target.value })} className="input" /></label>
              <button type="button" disabled={savingTransformer || !selectedId} onClick={() => void saveTransformer(false)} className="flex items-center justify-center gap-2 self-end rounded-lg bg-slate-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"><Save size={17} /> Atualizar selecionado</button>
              <button type="button" disabled={savingTransformer} onClick={() => void saveTransformer(true)} className="flex items-center justify-center gap-2 self-end rounded-lg border border-primary px-4 py-3 text-sm font-semibold text-primary disabled:opacity-60"><Plus size={17} /> Adicionar como novo</button>
            </div>
            <p className="mt-3 text-xs text-slate-500">Para vários transformadores iguais, informe a quantidade. Se o analisador estiver em apenas um transformador, cadastre e selecione essa unidade separadamente. Não misture medições de pontos elétricos diferentes.</p>
          </section>

          <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <h2 className="flex items-center gap-2 font-bold text-blue-950"><FileUp size={19} /> Importar relatório Embrasul</h2>
            <p className="mt-1 text-sm text-blue-800">Informe a condição real do capacitor durante a campanha. O sistema não ignora o reativo capacitivo: ele contextualiza a medição.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <label className="text-sm text-blue-950"><span className="mb-1 block font-medium">Capacitor fixo durante a medição</span><select value={fixedCapacitorConnected ? "ligado" : "desligado"} onChange={(e) => setFixedCapacitorConnected(e.target.value === "ligado")} className="input"><option value="ligado">Ligado</option><option value="desligado">Desligado</option></select></label>
              <label className="text-sm text-blue-950"><span className="mb-1 block font-medium">Potência fixa (kVAr)</span><input value={fixedCapacitorKvar} disabled={!fixedCapacitorConnected} onChange={(e) => setFixedCapacitorKvar(e.target.value)} className="input disabled:bg-slate-100" /></label>
              <label className="flex cursor-pointer items-center justify-center gap-2 self-end rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white">
                {importing ? <Loader2 className="animate-spin" size={18} /> : <FileUp size={18} />} Selecionar PDF
                <input type="file" accept="application/pdf" className="hidden" disabled={importing} onChange={(e) => { void importEmbrasulPdf(e.target.files?.[0]); e.currentTarget.value = ""; }} />
              </label>
              <label className="flex cursor-pointer items-center justify-center gap-2 self-end rounded-lg bg-violet-700 px-4 py-3 font-semibold text-white">
                {importingSeries ? <Loader2 className="animate-spin" size={18} /> : <FileUp size={18} />} Série TXT/CSV
                <input type="file" accept=".txt,.csv,text/plain,text/csv" className="hidden" disabled={importingSeries} onChange={(e) => { void importEmbrasulSeries(e.target.files?.[0]); e.currentTarget.value = ""; }} />
              </label>
            </div>
            <p className="mt-3 text-xs text-blue-700">PDF importa apenas a média para diagnóstico. TXT/CSV Embrasul importa cada intervalo e pode liberar o dimensionamento quando houver campanha representativa.</p>
          </section>

          <section className="grid gap-4 md:grid-cols-4">
            <Metric title="Amostras" value={String(analysis.samples)} detail={`Confiança: ${analysis.confidence}`} />
            <Metric title="Carga média" value={`${fmt(analysis.averageLoadPercent)}%`} detail={`mín. ${fmt(analysis.minimumLoadPercent)}% · máx. ${fmt(analysis.maximumLoadPercent)}%`} />
            <Metric title="FP médio" value={fmt(analysis.averagePowerFactor, 3)} detail={`mín. ${fmt(analysis.minimumPowerFactor, 3)}`} />
            <Metric title="Triagem" value={analysis.status.replace("_", " ")} detail={`motor v${analysis.version}`} />
          </section>

          <section className="rounded-xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div><h2 className="flex items-center gap-2 font-bold text-violet-950"><ShieldCheck size={19} /> Recomendação técnica do banco</h2><p className="mt-1 text-sm text-violet-800">Motor auditável v{recommendation.engineVersion}. A recomendação considera somente as medições do transformador/conjunto selecionado.</p></div>
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold uppercase ${recommendation.specificationAllowed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{recommendation.specificationAllowed ? "especificação liberada" : "diagnóstico preliminar"}</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <label className="text-sm text-violet-950"><span className="mb-1 block font-medium">Objetivo da análise</span><select value={recommendationMode} onChange={(e) => setRecommendationMode(e.target.value as RecommendationMode)} className="input"><option value="novo_banco">Projetar banco novo</option><option value="otimizar_existente">Otimizar banco existente</option></select></label>
              <label className="text-sm text-violet-950"><span className="mb-1 block font-medium">FP alvo</span><input inputMode="decimal" value={targetPowerFactor} onChange={(e) => setTargetPowerFactor(e.target.value)} className="input" /></label>
              {recommendationMode === "otimizar_existente" && <label className="text-sm text-violet-950"><span className="mb-1 block font-medium">Banco total instalado (kVAr)</span><input inputMode="decimal" value={installedBankKvar} onChange={(e) => setInstalledBankKvar(e.target.value)} className="input" /></label>}
              <div className="rounded-lg bg-white p-3 text-sm"><span className="block text-xs font-semibold uppercase text-slate-500">Decisão</span><strong className="mt-1 block text-violet-950">{recommendationLabel(recommendation.decision)}</strong><span className="text-xs text-slate-500">Confiança: {recommendation.confidence}</span></div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric title="Potência indicada" value={recommendation.recommendedKvar == null ? "Não liberada" : `${fmt(recommendation.recommendedKvar)} kVAr`} detail={recommendation.p90RequiredKvar == null ? "P90 indisponível" : `necessidade P90: ${fmt(recommendation.p90RequiredKvar)} kVAr`} />
              <Metric title="Estágios sugeridos" value={recommendation.suggestedStagesKvar.length ? recommendation.suggestedStagesKvar.map((value) => fmt(value)).join(" + ") : "—"} detail={recommendation.suggestedStagesKvar.length ? "valores comerciais em kVAr" : "aguardando campanha válida"} />
              <Metric title="Campanha" value={`${recommendation.validSamples} amostra(s)`} detail={recommendation.coverageHours == null ? "cobertura não determinada" : `${fmt(recommendation.coverageHours)} horas de cobertura`} />
              <Metric title="Comportamento capacitivo" value={`${fmt(recommendation.capacitivePercent)}%`} detail={`${recommendation.capacitiveSamples} capacitiva(s) · ${recommendation.inductiveSamples} indutiva(s)`} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-violet-200 bg-white p-4"><h3 className="mb-2 text-sm font-bold text-violet-950">Ações recomendadas</h3>{recommendation.actions.map((action) => <p key={action} className="mb-2 flex gap-2 text-sm text-slate-700"><CheckCircle2 className="mt-0.5 shrink-0 text-violet-600" size={16} />{action}</p>)}</div>
              <div className="rounded-lg border border-amber-200 bg-white p-4"><h3 className="mb-2 text-sm font-bold text-amber-900">Alertas e limitações</h3>{recommendation.warnings.length ? recommendation.warnings.map((warning) => <p key={warning} className="mb-2 flex gap-2 text-sm text-amber-800"><AlertTriangle className="mt-0.5 shrink-0" size={16} />{warning}</p>) : <p className="text-sm text-emerald-700">Nenhuma limitação adicional identificada pelo motor.</p>}</div>
            </div>
            <p className="mt-3 text-xs text-violet-700">Fórmula: {recommendation.formula}</p>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <form onSubmit={saveMeasurement} className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 font-bold"><Plus size={19} /> Nova medição</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Data e hora"><input type="datetime-local" required value={form.measured_at} onChange={(e) => setForm({ ...form, measured_at: e.target.value })} className="input" /></Field>
                <Field label="Intervalo (min)"><input inputMode="decimal" value={form.interval_minutes} onChange={(e) => setForm({ ...form, interval_minutes: e.target.value })} className="input" /></Field>
                <Field label="P ativa (kW)"><input inputMode="decimal" value={form.active_power_kw} onChange={(e) => setForm({ ...form, active_power_kw: e.target.value })} className="input" /></Field>
                <Field label="Q reativa (kVAr)"><input inputMode="decimal" value={form.reactive_power_kvar} onChange={(e) => setForm({ ...form, reactive_power_kvar: e.target.value })} className="input" placeholder="negativo = capacitivo" /></Field>
                <Field label="S aparente (kVA)"><input inputMode="decimal" value={form.apparent_power_kva} onChange={(e) => setForm({ ...form, apparent_power_kva: e.target.value })} className="input" /></Field>
                <Field label="Fator de potência"><input inputMode="decimal" value={form.power_factor} onChange={(e) => setForm({ ...form, power_factor: e.target.value })} className="input" placeholder="ex.: 0,94" /></Field>
                <Field label="Tensão (V)"><input inputMode="decimal" value={form.voltage_v} onChange={(e) => setForm({ ...form, voltage_v: e.target.value })} className="input" /></Field>
                <Field label="Corrente (A)"><input inputMode="decimal" value={form.current_a} onChange={(e) => setForm({ ...form, current_a: e.target.value })} className="input" /></Field>
                <Field label="THDv (%)"><input inputMode="decimal" value={form.thdv_percent} onChange={(e) => setForm({ ...form, thdv_percent: e.target.value })} className="input" /></Field>
                <Field label="THDi (%)"><input inputMode="decimal" value={form.thdi_percent} onChange={(e) => setForm({ ...form, thdi_percent: e.target.value })} className="input" /></Field>
                <Field label="Origem"><select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="input"><option value="manual">Manual</option><option value="analisador">Analisador</option><option value="importacao">Importação</option><option value="iot">IoT</option><option value="mqtt">MQTT</option><option value="modbus">Modbus</option></select></Field>
                <Field label="Equipamento"><input value={form.source_device} onChange={(e) => setForm({ ...form, source_device: e.target.value })} className="input" /></Field>
              </div>
              <Field label="Observações"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input min-h-20" /></Field>
              <button disabled={saving} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />} Salvar medição auditável</button>
            </form>

            <div className="space-y-4">
              <section className="rounded-xl border bg-white p-5 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 font-bold"><Activity size={19} /> Diagnóstico operacional</h2>
                {!analysis.alerts.length ? <p className="flex gap-2 text-sm text-emerald-700"><CheckCircle2 size={18} /> Nenhum alerta nos dados disponíveis.</p> : analysis.alerts.map((alert) => <p key={alert} className="mb-2 flex gap-2 text-sm text-amber-800"><AlertTriangle className="shrink-0" size={18} />{alert}</p>)}
                <div className="mt-4 border-t pt-4">{analysis.limitations.map((item) => <p key={item} className="mb-2 text-xs text-slate-500">• {item}</p>)}</div>
              </section>
              <section className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Histórico recente</h2><button type="button" onClick={() => loadMeasurements(selectedId)} className="rounded-md p-2 text-primary hover:bg-slate-100" title="Atualizar"><RefreshCw size={18} /></button></div>
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full text-left text-xs"><thead className="sticky top-0 bg-white text-slate-500"><tr><th className="py-2">Data</th><th>P kW</th><th>Q kVAr</th><th>S kVA</th><th>FP</th><th>THDv/i</th></tr></thead><tbody>
                    {measurements.map((item) => <tr key={item.id} className="border-t"><td className="py-2 pr-2">{new Date(item.measured_at).toLocaleString("pt-BR")}</td><td>{fmt(item.active_power_kw)}</td><td>{fmt(item.reactive_power_kvar)}</td><td>{fmt(item.apparent_power_kva)}</td><td>{fmt(item.power_factor, 3)}</td><td>{fmt(item.thdv_percent)}/{fmt(item.thdi_percent)}</td></tr>)}
                    {!measurements.length && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Ainda não há medições para este transformador.</td></tr>}
                  </tbody></table>
                </div>
              </section>
            </div>
          </section>
        </>
      )}
      <style jsx>{`.input{width:100%;border:1px solid #cbd5e1;border-radius:.5rem;padding:.625rem .75rem;background:#fff}.input:focus{outline:2px solid #2563eb33;border-color:#2563eb}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="mb-3 block text-sm text-slate-700"><span className="mb-1 block font-medium">{label}</span>{children}</label>;
}

function Metric({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <div className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p><p className="mt-1 text-2xl font-bold capitalize text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}

function recommendationLabel(decision: string) {
  return ({
    coletar_dados: "Coletar mais dados",
    corrigir_sobrecompensacao: "Corrigir sobrecompensação",
    recomendar_banco: "Dimensionar/reconfigurar banco",
    manter_banco: "Manter potência instalada",
  } as Record<string, string>)[decision] ?? decision;
}
