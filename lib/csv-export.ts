function protectSpreadsheetFormula(value: string) {
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

export function escapeCsvCell(value: unknown) {
  const normalized = protectSpreadsheetFormula(value === null || value === undefined ? '' : String(value));
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function buildCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows]
    .map(row => row.map(escapeCsvCell).join(';'))
    .join('\r\n');
}
