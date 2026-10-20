import Image from 'next/image';
import {professionalReportLines,type ReportProfessional} from '@/lib/report-professional';
export function ReportProfessionalBlock({profile}:{profile?:ReportProfessional}){
 const lines=professionalReportLines(profile);if(!lines.length)return null;
 return <section className="report-professional mt-6 space-y-1 border-t pt-4">
  <h3 className="font-bold">{lines[0]}</h3>
  {profile?.signatureDataUrl&&<Image src={profile.signatureDataUrl} alt="Assinatura do responsável" unoptimized priority width={profile.signatureWidth??400} height={profile.signatureHeight??100} style={{maxWidth:'100mm',maxHeight:'24mm',width:'auto',height:'auto',objectFit:'contain'}}/>}
  {lines.slice(1).map((line,index)=><p key={index} className="text-sm">{line}</p>)}
 </section>;
}
export function ReportPrintView({lines,profile,id,screenHidden=false}:{lines:string[];profile?:ReportProfessional;id?:string;screenHidden?:boolean}){
 return <article id={id} className={`audit-report-surface ${screenHidden?'audit-print-only':''} space-y-3`}>
  {lines.map((line,index)=>!line?<div key={index} className="report-spacer"/>:line===line.toLocaleUpperCase('pt-BR')?<h3 key={index} className="font-bold text-primary">{line}</h3>:<p key={index} className="whitespace-pre-wrap text-sm">{line}</p>)}
  <ReportProfessionalBlock profile={profile}/>
 </article>;
}
export function ReportPrintStyles(){
 return <style>{`
 .audit-print-only {display:none;}
 .report-spacer {height:4mm;}
 @media print {
  @page {size:A4; margin:16mm;}
  html,body {height:auto!important; min-height:0!important; background:white!important;}
  body *:not(:has(.audit-report-surface)):not(.audit-report-surface):not(.audit-report-surface *) {display:none!important;}
  body *:has(.audit-report-surface) {display:block!important;position:static!important;min-height:0!important;height:auto!important;max-height:none!important;overflow:visible!important;float:none!important;padding:0!important;margin:0!important;width:auto!important;max-width:none!important;}
  .audit-report-surface {display:block!important;position:static!important;width:auto!important;padding:0!important;margin:0!important;background:white!important;color:#111!important;font:10pt/1.4 Arial,sans-serif!important;}
  .audit-report-surface p {margin:0 0 2.5mm;white-space:pre-wrap;overflow-wrap:anywhere;orphans:2;widows:2;}
  .audit-report-surface h3 {margin:4mm 0 2mm;break-after:avoid-page;color:#123b4c;}
  .audit-report-surface .report-spacer {height:2mm;}
  .audit-report-surface .report-professional {break-inside:avoid-page;margin-top:6mm;padding-top:3mm;border-top:1px solid #999;}
  body [hidden],body [hidden] * {display:none!important;}
 }
 `}</style>;
}
