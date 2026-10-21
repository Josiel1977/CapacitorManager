import Image from 'next/image';
import {groupReportLines,isReportHeading} from '@/lib/report-layout';
import {professionalReportLines,type ReportProfessional} from '@/lib/report-professional';
export function ReportProfessionalBlock({profile}:{profile?:ReportProfessional}){
 const lines=professionalReportLines(profile);if(!lines.length)return null;
 return <section className="report-professional mt-6 space-y-1 pt-4">
  <h3 className="font-bold">{lines[0]}</h3>
  {profile?.signatureDataUrl&&<Image src={profile.signatureDataUrl} alt="Assinatura do responsável" unoptimized priority width={profile.signatureWidth??400} height={profile.signatureHeight??100} style={{maxWidth:'100mm',maxHeight:'24mm',width:'auto',height:'auto',objectFit:'contain'}}/>}
  {lines.slice(1).map((line,index)=><p key={index} className="text-sm">{line}</p>)}
 </section>;
}
export function ReportPrintView({lines,profile,id,screenHidden=false}:{lines:string[];profile?:ReportProfessional;id?:string;screenHidden?:boolean}){
 return <article id={id} className={`audit-report-surface ${screenHidden?'audit-print-only':''} space-y-3`}>
  {groupReportLines(lines).map((line,index)=>!line?<div key={index} className="report-spacer"/>:index===0?<h2 key={index} className="report-title font-bold text-primary">{line}</h2>:isReportHeading(line)?<h3 key={index} className="report-section font-bold text-primary">{line}</h3>:<p key={index} className="whitespace-pre-wrap text-sm">{line}</p>)}
  <ReportProfessionalBlock profile={profile}/>
 </article>;
}
export function ReportPrintStyles(){
 return <style>{`
 .audit-print-only {display:none;}
 .report-spacer {height:4mm;}
 @media print {
  @page {size:A4; margin:19mm;}
  html,body {height:auto!important; min-height:0!important; background:white!important;}
  body *:not(:has(.audit-report-surface)):not(.audit-report-surface):not(.audit-report-surface *) {display:none!important;}
  body *:has(.audit-report-surface) {display:block!important;position:static!important;min-height:0!important;height:auto!important;max-height:none!important;overflow:visible!important;float:none!important;padding:0!important;margin:0!important;width:auto!important;max-width:none!important;}
  .audit-report-surface {display:block!important;position:static!important;width:auto!important;padding:0!important;margin:0!important;background:white!important;color:#111!important;font:10.5pt/1.3 Arial,sans-serif!important;}
  .audit-report-surface p {font:inherit!important;margin:0 0 1mm!important;white-space:pre-wrap;overflow-wrap:anywhere;orphans:2;widows:2;}
  .audit-report-surface .report-title {font:700 17pt/1.2 Arial,sans-serif!important;color:#174056!important;margin:0 0 5mm!important;break-after:avoid-page;}\n  .audit-report-surface .report-section {font:700 10.5pt/1.4 Arial,sans-serif!important;margin:4mm 0 2mm!important;padding:2.5mm 3mm!important;background:#ebf2f6!important;color:#174056!important;border-left:3px solid #174056;break-inside:avoid-page;break-after:avoid-page;print-color-adjust:exact;}\n  .audit-report-surface .report-professional h3 {font:700 10.5pt/1.4 Arial,sans-serif!important;}
  .audit-report-surface .report-spacer {display:none!important;}
  .audit-report-surface .report-professional {break-inside:avoid-page;margin-top:6mm;padding-top:3mm;border-top:1px solid #999;max-width:100%;}
  .audit-report-surface .report-professional img {float:right;max-height:22mm!important;max-width:85mm!important;margin-left:8mm;}
  .audit-report-surface .report-professional::after {content:"";display:block;clear:both;}
  body [hidden],body [hidden] * {display:none!important;}
 }
 `}</style>;
}
