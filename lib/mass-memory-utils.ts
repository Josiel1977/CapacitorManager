export const parseSignedBrazilianNumber = (value: unknown): number => {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  if (!raw || raw === "-" || raw === "#VALOR!" || raw === "#DIV/0!") return 0;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : 0;
};

export const normalizeMassMemoryDateTime = (dateValue: string, timeValue: string) => {
  const cleanDate = String(dateValue || "").trim();
  const cleanTime = String(timeValue || "00:00").trim();
  const timeMatch = cleanTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const hour = (timeMatch?.[1] ?? "00").padStart(2, "0");
  const minute = (timeMatch?.[2] ?? "00").padStart(2, "0");
  const second = (timeMatch?.[3] ?? "00").padStart(2, "0");
  const br = cleanDate.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (br) {
    const day = br[1].padStart(2, "0");
    const month = br[2].padStart(2, "0");
    if (!br[3]) return { displayDate: `${day}/${month}`, displayTime: `${hour}:${minute}`, timestamp: "" };
    const rawYear = br[3];
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return { displayDate: `${day}/${month}/${year}`, displayTime: `${hour}:${minute}`, timestamp: `${year}-${month}-${day}T${hour}:${minute}:${second}` };
  }
  const iso = cleanDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return { displayDate: `${iso[3]}/${iso[2]}/${iso[1]}`, displayTime: `${hour}:${minute}`, timestamp: `${iso[1]}-${iso[2]}-${iso[3]}T${hour}:${minute}:${second}` };
  }
  return { displayDate: cleanDate, displayTime: `${hour}:${minute}`, timestamp: "" };
};
