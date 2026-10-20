'use client';
import {useState} from 'react';
import {parseReportProfessional,type ReportProfessional} from '@/lib/report-professional';
const key='cm-report-professional-v1';
export default function ReportProfessionalForm({value,onChange}:{value:ReportProfessional;onChange:(value:ReportProfessional)=>void}){
 const [message,setMessage]=useState('');
 function field(name:'name'|'title'|'registration'|'status',text:string){onChange({...value,[name]:text});setMessage('');}
 function save(){try{localStorage.setItem(key,JSON.stringify(parseReportProfessional(value)));setMessage('Dados e assinatura salvos neste navegador.');}catch(error){setMessage(error instanceof Error?error.message:'Não foi possível salvar neste navegador.');}}
 function restore(){try{const raw=localStorage.getItem(key);if(!raw){setMessage('Nenhuma identificação salva neste navegador.');return;}onChange(parseReportProfessional(JSON.parse(raw)));setMessage('Identificação restaurada. Confira o nome e o registro antes de emitir.');}catch{setMessage('Não foi possível restaurar a identificação.');}}
 async function signature(file:File|undefined){if(!file)return;setMessage('');try{
  if(file.size>500000||!['image/png','image/jpeg'].includes(file.type))throw new Error('Use imagem PNG ou JPEG de até 500 KB.');
  const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Falha na leitura da assinatura.'));reader.readAsDataURL(file);});
  const dimensions=await new Promise<{width:number;height:number}>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>reject(new Error('A imagem não pôde ser lida.'));img.src=dataUrl;});
  onChange(parseReportProfessional({...value,signatureDataUrl:dataUrl,signatureWidth:dimensions.width,signatureHeight:dimensions.height}));setMessage('Assinatura adicionada aos relatórios desta sessão.');
 }catch(error){setMessage(error instanceof Error?error.message:'Não foi possível ler a assinatura.');}}
 return <section className="space-y-4 rounded-xl border bg-white p-5">
  <h2 className="text-lg font-bold">Identificação e assinatura nos relatórios</h2>
  <p className="text-sm">Preencha uma vez para usar na auditoria, consultoria e expansão. Confira a grafia do nome e informe seu número de CRT/CFT. A situação do registro é declarada por você; não há consulta automática ao conselho.</p>
  <div className="grid gap-3 sm:grid-cols-2">{([['name','Nome do responsável'],['title','Formação / título profissional'],['registration','Número do CRT/CFT e regional'],['status','Situação declarada do CRT']] as const).map(([name,label])=><label key={name} className="text-sm">{label}<input maxLength={160} className="mt-1 w-full rounded border p-2" value={value[name]} onChange={e=>field(name,e.target.value)}/></label>)}</div>
  <label className="block text-sm">Assinatura por imagem (opcional: PNG ou JPEG, até 500 KB)<input aria-label="Imagem da assinatura" type="file" accept="image/png,image/jpeg" className="mt-2 block text-sm" onChange={e=>{void signature(e.target.files?.[0]);e.target.value='';}}/></label>
  <p className="text-xs text-slate-600">Use uma imagem da sua própria assinatura. A imagem é uma representação visual; não é assinatura digital certificada.</p>
  <div className="flex flex-wrap gap-3"><button type="button" className="rounded border px-3 py-2 text-sm" onClick={save}>Salvar dados e assinatura neste navegador</button><button type="button" className="rounded border px-3 py-2 text-sm" onClick={restore}>Restaurar dados salvos</button><button type="button" className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={!value.signatureDataUrl} onClick={()=>onChange({...value,signatureDataUrl:null,signatureWidth:null,signatureHeight:null})}>Remover assinatura da sessão</button></div>
  {message&&<p role="status" className="rounded bg-blue-50 p-3 text-sm">{message}</p>}
 </section>;
}
