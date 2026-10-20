import { createConsultancyPdf } from './consultancy-pdf.ts';

/** Mesmo renderizador com fonte incorporada usado nos estudos tarifários. */
export async function createEnergyDiagnosisPdf(reportLines: string[]) {
  return createConsultancyPdf(reportLines);
}
