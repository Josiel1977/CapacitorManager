import { NextResponse } from 'next/server';
import { ANEEL_DATASET,ANEEL_RESOURCE,normalizeTariff,tariffQuery } from '@/lib/aneel-tariffs';
export const runtime='nodejs';
export const maxDuration=40;
export async function GET(request:Request) {
  const p=new URL(request.url).searchParams;
  let query:URLSearchParams;
  try {
    query=p.get('agents')==='1'?new URLSearchParams({resource_id:ANEEL_RESOURCE,fields:'SigAgente',distinct:'true',limit:'1000'}):tariffQuery(p.get('agent')??'',p.get('subgroup')??'',p.get('date')??'');
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Parâmetros inválidos.'},{status:400});}
  try {
    const url=new URL('https://dadosabertos.aneel.gov.br/api/3/action/datastore_search');url.search=query.toString();
    const response=await fetch(url,{signal:AbortSignal.timeout(30000),next:{revalidate:86400}});
    if(!response.ok)throw new Error();
    const body=await response.json();
    if(!body.success || !Array.isArray(body.result?.records))throw new Error();
    const records:Record<string,unknown>[]=body.result.records;
    if(typeof body.result.total!=='number'||body.result.total>records.length) return NextResponse.json({error:'A consulta excedeu o limite. Não foi retornado um catálogo parcial.'},{status:422});
    if(p.get('agents')==='1') return NextResponse.json({agents:records.map(r=>r.SigAgente).filter((v):v is string=>typeof v==='string'),source:ANEEL_DATASET});
    const date=p.get('date')!;
    const rows=records.filter(r=>typeof r.DatInicioVigencia==='string'&&typeof r.DatFimVigencia==='string'&&r.DatInicioVigencia<=date&&r.DatFimVigencia>=date).map(normalizeTariff);
    return NextResponse.json({tariffs:rows.filter(r=>r!==null),rejected:rows.filter(r=>r===null).length,source:ANEEL_DATASET,consultedAt:new Date().toISOString(),cacheHours:24});
  } catch {return NextResponse.json({error:'A base ANEEL está indisponível ou demorou a responder. Nenhuma tarifa foi estimada. Tente novamente ou informe tarifas documentadas manualmente.'},{status:503});}
}
