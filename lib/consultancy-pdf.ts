import {consultancyFont} from './consultancy-pdf-font.ts';
import {parseReportProfessional,professionalReportLines,type ReportProfessional} from './report-professional.ts';
export async function createConsultancyPdf(lines:string[],profile?:ReportProfessional){
 const {jsPDF}=await import('jspdf');
 const pdf=new jsPDF({unit:'mm',format:'a4'});
 pdf.addFileToVFS('ConsultancySans.ttf',consultancyFont);
 pdf.addFont('ConsultancySans.ttf','ConsultancySans','normal');
 const margin=18,width=174,bottom=276;
 let y=28;
 function header(){pdf.setFont('ConsultancySans','normal');pdf.setFontSize(8);pdf.setTextColor(35,73,96);pdf.text('CAPACITOR MANAGER  |  CONSULTORIA TÉCNICA',margin,13);pdf.setDrawColor(35,73,96);pdf.line(margin,17,192,17);}
 function next(){const size=pdf.getFontSize(),color=pdf.getTextColor();pdf.addPage();header();pdf.setFontSize(size);pdf.setTextColor(color);y=28;}
 header();
 for(const text of lines){
  if(!text){y+=3;continue;}
  const heading=text===text.toLocaleUpperCase('pt-BR');
  if(y+(heading?12:5)>bottom)next();
  pdf.setFont('ConsultancySans','normal');pdf.setFontSize(heading?10.5:9);pdf.setTextColor(...(heading?[23,64,86]:[35,42,52]) as [number,number,number]);
  if(heading)y+=2;
  const wrapped:string[]=pdf.splitTextToSize(text,width);
  for(const line of wrapped){if(y>bottom)next();pdf.text(line,margin,y);y+=heading?5.5:4.8;}
  y+=heading?2.5:2;
 }
 if(profile){
  const professional=parseReportProfessional(profile),identification=professionalReportLines(professional);
  if(identification.length){
   pdf.setFont('ConsultancySans','normal');pdf.setFontSize(9);
   const rows=identification.map(text=>pdf.splitTextToSize(text,width) as string[]);
   const imageHeight=professional.signatureDataUrl?Math.min(24,100*professional.signatureHeight!/professional.signatureWidth!):0;
   const imageWidth=professional.signatureDataUrl?Math.min(100,24*professional.signatureWidth!/professional.signatureHeight!):0;
   const blockHeight=rows.reduce((sum,group)=>sum+group.length*4.8+2,0)+imageHeight+14;
   if(y+blockHeight>bottom)next();
   y+=5;pdf.setDrawColor(130,140,150);pdf.line(margin,y,192,y);y+=6;
   pdf.setFontSize(9);pdf.setTextColor(35,42,52);
   for(let index=0;index<rows.length;index++){
    for(const row of rows[index]){pdf.text(row,margin,y);y+=4.8;}
    y+=2;
    if(index===0&&professional.signatureDataUrl){
     pdf.addImage(professional.signatureDataUrl,professional.signatureDataUrl.startsWith('data:image/jpeg')?'JPEG':'PNG',margin,y,imageWidth,imageHeight);y+=imageHeight+2;
    }
   }
  }
 }
 const pages=pdf.getNumberOfPages();
 for(let page=1;page<=pages;page++){pdf.setPage(page);pdf.setFont('ConsultancySans','normal');pdf.setFontSize(7);pdf.setTextColor(80,90,100);pdf.text(`CapacitorManager | Estudo condicionado à validação técnica e contratual | ${page}/${pages}`,margin,288);}
 return pdf;
}
