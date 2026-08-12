export const EMBRASUL_SERIES_VERSION = "1.0.0";

export interface EmbrasulSeriesMeasurement {
  measuredAt: string;
  activePowerKw: number;
  reactivePowerKvar: number;
  apparentPowerKva: number | null;
  powerFactor: number | null;
  voltageV: number | null;
  currentA: number | null;
  thdvPercent: number | null;
  thdiPercent: number | null;
  analyzerAction: string | null;
}

export interface EmbrasulSeriesResult {
  version: string;
  rowsRead: number;
  measurements: EmbrasulSeriesMeasurement[];
  rejectedRows: Array<{ row: number; reason: string }>;
  mappedColumns: Record<string, string | null>;
  intervalMinutes: number | null;
  startedAt: string | null;
  endedAt: string | null;
  capacitiveSamples: number;
  warnings: string[];
  analyzer: string | null;
  serialNumber: string | null;
}

type CsvRow = Record<string, unknown>;

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const aliases: Record<string, RegExp[]> = {
  dateTime: [/^data hora$/, /^data e hora$/, /^date time$/, /^timestamp$/, /^datahora$/, /^instante$/],
  date: [/^data$/, /^date$/],
  time: [/^hora$/, /^time$/],
  p: [/^p$/, /^p kw$/, /^p3f$/, /^potencia ativa$/, /^potencia ativa kw$/, /^ativa total/, /^kw total$/],
  q: [/^q$/, /^q kvar$/, /^q3f$/, /^potencia reativa$/, /^potencia reativa kvar$/, /^reativa total/, /^kvar total$/],
  s: [/^s$/, /^s kva$/, /^s3f$/, /^potencia aparente$/, /^potencia aparente kva$/, /^aparente total/, /^kva total$/],
  fp: [/^fp$/, /^fp3f$/, /^fator de potencia$/, /^power factor$/, /^cos phi$/, /^cosfi$/],
  voltage: [/^tensao$/, /^tensao v$/, /^voltage$/, /^v medio$/, /^v media$/, /^v rms$/],
  current: [/^corrente$/, /^corrente a$/, /^current$/, /^i medio$/, /^i media$/, /^i rms$/],
  thdv: [/^thdv$/, /^thd v$/, /^thdv %$/, /^distorcao tensao/],
  thdi: [/^thdi$/, /^thd i$/, /^thdi %$/, /^distorcao corrente/],
  analyzerAction: [/^kvar 0 980$/, /^acao$/, /^recomendacao$/],
};

const findColumn = (headers: string[], field: string) => headers.find((header) => aliases[field].some((pattern) => pattern.test(normalize(header)))) ?? null;

const numeric = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  let clean = value.trim().replace(/\s/g, "").replace(/[%a-zA-Z]/g, "");
  if (clean.includes(",") && clean.includes(".")) clean = clean.lastIndexOf(",") > clean.lastIndexOf(".") ? clean.replace(/\./g, "").replace(",", ".") : clean.replace(/,/g, "");
  else if (clean.includes(",")) clean = clean.replace(",", ".");
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDate = (value: unknown) => {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value !== "string") return null;
  const text = value.trim();
  const br = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:[,.]\d+)?)?)?$/);
  if (br) {
    const year = br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3]);
    const date = new Date(year, Number(br[2]) - 1, Number(br[1]), Number(br[4] ?? 0), Number(br[5] ?? 0), Number(br[6] ?? 0));
    return Number.isFinite(date.getTime()) ? date : null;
  }
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const resolveDate = (row: CsvRow, columns: Record<string, string | null>) => {
  if (columns.dateTime) return parseDate(row[columns.dateTime]);
  if (!columns.date) return null;
  const date = String(row[columns.date] ?? "").trim();
  const time = columns.time ? String(row[columns.time] ?? "").trim() : "00:00:00";
  return parseDate(`${date} ${time}`);
};

const median = (values: number[]) => {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};

export function parseEmbrasulSeries(rows: CsvRow[]): EmbrasulSeriesResult {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const mappedColumns = {
    dateTime: findColumn(headers, "dateTime"), date: findColumn(headers, "date"), time: findColumn(headers, "time"),
    p: findColumn(headers, "p"), q: findColumn(headers, "q"), s: findColumn(headers, "s"), fp: findColumn(headers, "fp"),
    voltage: findColumn(headers, "voltage"), current: findColumn(headers, "current"), thdv: findColumn(headers, "thdv"), thdi: findColumn(headers, "thdi"), analyzerAction: findColumn(headers, "analyzerAction"),
  };
  const warnings: string[] = [];
  const rejectedRows: EmbrasulSeriesResult["rejectedRows"] = [];
  if ((!mappedColumns.dateTime && !mappedColumns.date) || !mappedColumns.p || !mappedColumns.q) {
    warnings.push("Formato não reconhecido: são obrigatórias data/hora, potência ativa P e potência reativa Q.");
    return { version: EMBRASUL_SERIES_VERSION, rowsRead: rows.length, measurements: [], rejectedRows, mappedColumns, intervalMinutes: null, startedAt: null, endedAt: null, capacitiveSamples: 0, warnings, analyzer: null, serialNumber: null };
  }

  const embrasulThreePhase = normalize(mappedColumns.p ?? "") === "p3f" && normalize(mappedColumns.q ?? "") === "q3f";
  const powerScale = embrasulThreePhase ? 0.001 : 1;

  const measurements = rows.flatMap<EmbrasulSeriesMeasurement>((row, index) => {
    const date = resolveDate(row, mappedColumns);
    const rawP = numeric(row[mappedColumns.p!]);
    const rawQ = numeric(row[mappedColumns.q!]);
    const p = rawP == null ? null : rawP * powerScale;
    const q = rawQ == null ? null : rawQ * powerScale;
    if (!date || p == null || p <= 0 || q == null) {
      rejectedRows.push({ row: index + 2, reason: !date ? "Data/hora inválida" : p == null || p <= 0 ? "P ativa ausente ou não positiva" : "Q reativa ausente" });
      return [];
    }
    const rawS = mappedColumns.s ? numeric(row[mappedColumns.s]) : null;
    const informedS = rawS == null ? null : rawS * powerScale;
    const s = informedS != null && informedS >= 0 ? informedS : Math.sqrt(p ** 2 + q ** 2);
    const informedFp = mappedColumns.fp ? numeric(row[mappedColumns.fp]) : null;
    const absoluteFp = informedFp != null && Math.abs(informedFp) <= 1 && informedFp !== 0 ? Math.abs(informedFp) : Math.min(1, p / s);
    return [{
      measuredAt: date.toISOString(), activePowerKw: p, reactivePowerKvar: q, apparentPowerKva: s,
      powerFactor: q < 0 ? -absoluteFp : absoluteFp,
      voltageV: mappedColumns.voltage ? numeric(row[mappedColumns.voltage]) : null,
      currentA: mappedColumns.current ? numeric(row[mappedColumns.current]) : null,
      thdvPercent: mappedColumns.thdv ? numeric(row[mappedColumns.thdv]) : null,
      thdiPercent: mappedColumns.thdi ? numeric(row[mappedColumns.thdi]) : null,
      analyzerAction: mappedColumns.analyzerAction ? String(row[mappedColumns.analyzerAction] ?? "").trim() || null : null,
    }];
  }).sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt));

  const intervals = measurements.slice(1).map((item, index) => (Date.parse(item.measuredAt) - Date.parse(measurements[index].measuredAt)) / 60_000).filter((value) => value > 0 && value <= 1_440);
  if (!mappedColumns.thdv && !mappedColumns.thdi) warnings.push("Série sem THDv/THDi: não concluir sobre ressonância ou dessintonia.");
  if (rejectedRows.length) warnings.push(`${rejectedRows.length} linha(s) foram rejeitadas e não serão gravadas.`);
  if (measurements.length < 24) warnings.push("Série com menos de 24 amostras válidas: recomendação permanecerá bloqueada.");
  return {
    version: EMBRASUL_SERIES_VERSION, rowsRead: rows.length, measurements, rejectedRows, mappedColumns,
    intervalMinutes: median(intervals), startedAt: measurements[0]?.measuredAt ?? null,
    endedAt: measurements.at(-1)?.measuredAt ?? null,
    capacitiveSamples: measurements.filter((item) => item.reactivePowerKvar < 0).length, warnings,
    analyzer: null, serialNumber: null,
  };
}

export function parseEmbrasulSeriesText(text: string): EmbrasulSeriesResult {
  const normalizedText = text.replace(/^\uFEFF/, "");
  const lines = normalizedText.split(/\r?\n/).filter((line) => line.trim());
  const headerIndex = lines.findIndex((line) => /(?:^|[;\t])DATA(?:[;\t]|$)/i.test(line) && /(?:^|[;\t])HORA(?:[;\t]|$)/i.test(line));
  const header = lines[headerIndex] ?? "";
  const separator = header.includes("\t") ? "\t" : header.includes(";") ? ";" : ",";
  const columns = header.split(separator).map((value) => value.trim());
  const rows = headerIndex < 0 ? [] : lines.slice(headerIndex + 1).map((line) => {
    const values = line.split(separator);
    return Object.fromEntries(columns.map((column, index) => [column, values[index]?.trim() ?? ""]));
  });
  const result = parseEmbrasulSeries(rows);
  const identity = lines.slice(0, Math.max(0, headerIndex)).join(" ").match(/(EMBRASUL\s+[^\s]+).*?N\.S[:.]?\s*(\d+)/i);
  result.analyzer = identity?.[1] ?? null;
  result.serialNumber = identity?.[2] ?? null;
  if (headerIndex < 0) result.warnings.unshift("Cabeçalho DATA/HORA não encontrado no texto Embrasul.");
  return result;
}
