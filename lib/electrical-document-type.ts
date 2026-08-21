export type ElectricalDocumentType = 'equatorial_invoice' | 'embrasul_report' | 'unknown';

export function detectElectricalDocumentType(text: string, fileName = ''): ElectricalDocumentType {
  const normalized = `${fileName} ${text}`.replace(/\s+/g, ' ').trim();
  const equatorialSignals = [
    /Equatorial\s+(?:Par[aá]|Energia|Distribuidora)/i,
    /TUSD\s+Energia\s+(?:Fora\s+Ponta|Ponta)/i,
    /Consumo\s+Reativo\s+Excedente/i,
    /Demanda\s+Contratada/i,
  ].filter(pattern => pattern.test(normalized)).length;
  if (equatorialSignals >= 2 || (/EQTL/i.test(fileName) && equatorialSignals >= 1)) return 'equatorial_invoice';

  const embrasulSignals = [
    /EMBRASUL/i,
    /Pot[eê]ncias\s+m[eé]dias/i,
    /Intervalo\s+considerado/i,
    /N\.S[:.]?\s*\d+/i,
  ].filter(pattern => pattern.test(normalized)).length;
  if (embrasulSignals >= 2) return 'embrasul_report';

  return 'unknown';
}
