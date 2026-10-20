import { createConsultancyPdf } from './consultancy-pdf.ts';
import type {ReportProfessional} from './report-professional.ts';

/** Mesmo renderizador com fonte incorporada usado nos estudos tarifários. */
export async function createEnergyDiagnosisPdf(reportLines: string[],profile?:ReportProfessional) {
  return createConsultancyPdf(reportLines,profile);
}
