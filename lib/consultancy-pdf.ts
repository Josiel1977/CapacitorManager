import {consultancyFont} from './consultancy-pdf-font.ts';
import {parseReportProfessional,professionalReportLines,type ReportProfessional} from './report-professional.ts';

import {isReportHeading} from './report-layout.ts';

export async function createConsultancyPdf(lines:string[],profile?:ReportProfessional){
 const {jsPDF}=await import('jspdf');
 const pdf=new jsPDF({unit:'mm',format:'a4'});
 pdf.addFileToVFS('ConsultancySans.ttf',consultancyFont);
 pdf.addFont('ConsultancySans.ttf','ConsultancySans','normal');
 const margin=19,width=172,bottom=275,lineHeight=5.3;
 let y=29;
 function header(){
  pdf.setFont('ConsultancySans','normal');pdf.setFontSize(9);pdf.setTextColor(23,64,86);
  pdf.text('JM ELETRO SERVICE',margin,13);
  pdf.setFontSize(8);pdf.text('Capacitor Manager',191,13,{align:'right'});
  pdf.setDrawColor(23,64,86);pdf.setLineWidth(0.4);pdf.line(margin,18,191,18);
 }
 function next(){pdf.addPage();header();y=29;}
 function style(size:number,color:[number,number,number]){pdf.setFont('ConsultancySans','normal');pdf.setFontSize(size);pdf.setTextColor(...color);}
 header();
 for(let index=0;index<lines.length;index++){
  const text=lines[index];
  if(!text.trim()){y=Math.min(y+2,bottom);continue;}
  const title=index===0,heading=!title&&isReportHeading(text);
  const size=title?17:heading?10.5:10.5;
  style(size,[35,42,52]);
  const wrapped:string[]=pdf.splitTextToSize(text,width-(heading?6:0));
  if(title){
   const height=wrapped.length*8+5;if(y+height>bottom)next();
   style(17,[23,64,86]);
   for(const row of wrapped){pdf.text(row,margin,y);y+=8;}y+=4;
  }else if(heading){
   // Reserve the complete section label and the first body paragraph (up to five lines) together.
   const height=wrapped.length*5.4+5;
   if(y+height+lineHeight*5>bottom)next();
   pdf.setFillColor(235,242,246);pdf.rect(margin,y-1,width,height,'F');
   style(10.5,[23,64,86]);y+=4;
   for(const row of wrapped){pdf.text(row,margin+3,y);y+=5.4;}y+=4;
  }else{
   // Short paragraphs stay together; long notes can flow across pages.
   if(wrapped.length<=5&&y+wrapped.length*lineHeight>bottom)next();
   style(10.5,[35,42,52]);
   for(let row=0;row<wrapped.length;row++){
    if(y>bottom){next();style(10.5,[35,42,52]);}
    pdf.text(wrapped[row],margin,y);y+=lineHeight;
   }
   y+=2.5;
  }
 }
 if(profile){
  const professional=parseReportProfessional(profile),identification=professionalReportLines(professional);
  if(identification.length){
   style(10.5,[35,42,52]);
   const rows=identification.map(text=>pdf.splitTextToSize(text,width) as string[]);
   const imageHeight=professional.signatureDataUrl?Math.min(24,85*professional.signatureHeight!/professional.signatureWidth!):0;
   const imageWidth=professional.signatureDataUrl?Math.min(85,24*professional.signatureWidth!/professional.signatureHeight!):0;
   const blockHeight=rows.reduce((sum,group)=>sum+group.length*lineHeight+1.5,0)+imageHeight+16;
   if(y+blockHeight>bottom)next();
   y+=5;pdf.setDrawColor(160,175,185);pdf.setLineWidth(0.2);pdf.line(margin,y,191,y);y+=7;
   style(10.5,[35,42,52]);
   for(let index=0;index<rows.length;index++){
    for(const row of rows[index]){pdf.text(row,margin,y);y+=lineHeight;}y+=1.5;
    if(index===0&&professional.signatureDataUrl){
     pdf.addImage(professional.signatureDataUrl,professional.signatureDataUrl.startsWith('data:image/jpeg')?'JPEG':'PNG',margin,y,imageWidth,imageHeight);y+=imageHeight+2;
    }
   }
  }
 }
 const pages=pdf.getNumberOfPages();
 for(let page=1;page<=pages;page++){
  pdf.setPage(page);pdf.setDrawColor(195,205,212);pdf.setLineWidth(0.2);pdf.line(margin,282,191,282);
  style(8,[80,90,100]);pdf.text('JM Eletro Service | Consultoria técnica de energia',margin,288);
  pdf.text(`Página ${page} de ${pages}`,191,288,{align:'right'});
 }
 return pdf;
}
