export interface ReportProfessional {
  name: string; title: string; registration: string; status: string;
  signatureDataUrl: string | null; signatureWidth: number | null; signatureHeight: number | null;
}
export const newReportProfessional = (): ReportProfessional => ({
  name:'Josiel Maia',title:'Eletrotécnico',registration:'51693658291',status:'Ativo',
  signatureDataUrl:null,signatureWidth:null,signatureHeight:null,
});
export function parseReportProfessional(value: unknown): ReportProfessional {
  if(!value||typeof value!=='object')throw new Error('Identificação inválida.');
  const data=value as Record<string,unknown>;
  for(const key of ['name','title','registration','status'])if(typeof data[key]!=='string'||(data[key] as string).length>160)throw new Error('Identificação profissional inválida.');
  const url=data.signatureDataUrl;
  if(url!==null&&(typeof url!=='string'||url.length>700000||!/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(url)))throw new Error('Assinatura deve ser uma imagem PNG ou JPEG de até 500 KB.');
  for(const key of ['signatureWidth','signatureHeight'])if(url!==null&&(typeof data[key]!=='number'||!Number.isFinite(data[key])||(data[key] as number)<=0||(data[key] as number)>4096))throw new Error('Dimensões da assinatura inválidas.');
  if(url!==null&&(data.signatureWidth as number)*(data.signatureHeight as number)>4000000)throw new Error('Imagem da assinatura muito grande.');
  return {name:(data.name as string).trim(),title:(data.title as string).trim(),registration:(data.registration as string).trim(),status:(data.status as string).trim(),signatureDataUrl:url as string|null,signatureWidth:url===null?null:data.signatureWidth as number,signatureHeight:url===null?null:data.signatureHeight as number};
}
export function professionalReportLines(profile?: ReportProfessional): string[] {
  if(!profile)return [];
  const p=parseReportProfessional(profile);
  if(!p.name&&!p.registration&&!p.signatureDataUrl)return [];
  return ['ASSINATURA DO RESPONSÁVEL',`${p.name||'Nome não informado'}${p.title?' | '+p.title:''}`, 
    `CRT/CFT: ${p.registration||'número não informado'}`,
    `Situação declarada do registro: ${p.status||'não informada'}`];
}
