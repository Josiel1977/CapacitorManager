export async function createEnergyDiagnosisPdf(reportLines: string[]) {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const margin = 18; const bottom = 276; let y = 22;
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
      for (const paragraph of reportLines) {
        if (!paragraph) { y += 4; continue; }
        const heading = paragraph === paragraph.toLocaleUpperCase('pt-BR');
        pdf.setFont('helvetica', heading ? 'bold' : 'normal');
        pdf.setFontSize(heading ? 11 : 10);
        const wrapped: string[] = pdf.splitTextToSize(paragraph, 174);
        for (const line of wrapped) {
          if (y > bottom) { pdf.addPage(); y = 22; }
          pdf.text(line, margin, y); y += 5;
        }
        y += 2;
      }
      const pages = pdf.getNumberOfPages();
      for (let page = 1; page <= pages; page++) {
        pdf.setPage(page); pdf.setFont('helvetica','normal'); pdf.setFontSize(8);
        pdf.text(`Capacitor Manager | ${page}/${pages}`, margin, 289);
      }
  return pdf;
}
