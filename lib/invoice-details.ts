export interface InvoiceDetails {
  cliente: string | null;
  documento: string | null;
  endereco: string | null;
  unidade_consumidora: string | null;
  grupo: string | null;
  subgrupo: string | null;
  classificacao: string | null;
  modalidade: string | null;
  fornecimento: string | null;
  vencimento: string | null;
  leitura_anterior: string | null;
  leitura_atual: string | null;
  proxima_leitura: string | null;
  perdas_percentual: number | null;
  itens: Array<{ descricao: string; quantidade: number | null; tarifa_com_tributos: number | null; tarifa_sem_tributos: number | null; pis_cofins: number | null; icms: number | null; valor: number }>;
  tributos: Array<{ nome: string; base: number; aliquota: number; valor: number }>;
  historico_ativo_injetado: Array<{ mes: string; ativo_kwh: number; injetado_kwh: number }>;
  soma_itens: number | null;
  texto_extraido: string;
}
const br = (s:string) => Number(s.replace(/\./g,'').replace(',','.'));
export function extractInvoiceDetails(text:string): InvoiceDetails {
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const n = text.replace(/\s+/g,' ');
  const lineValue = (label:RegExp) => {
    const line=lines.find(l=>label.test(l)); return line?.replace(label,'').trim() || null;
  };
  const labelNumber = /-?\d[\d.]*(?:,\d+)?/g;
  const itemLabel = /^(Consumo(?:\s+Compensado|\s+Reativo\s+Excedente(?:\s+(?:NP|FP))?)?\s*\([^)]*\)|TUSD\s+Energia\s+(?:Fora\s+)?Ponta\s*\([^)]*\)|Energia\s+Ativa\s+Injetada\s*\([^)]*\)|Parc\.\s*Inj\.[^(]*\([^)]*\)|Benef[íi]cio\s+Tarif[áa]rio\s+(?:Bruto|L[íi]quido)\s+SCEE|Adicional\s+Bandeira|Cip[^\d]*?|Parcela\s*\(\d+\/\d+\)|Multa|Corre[çc][ãa]o\s+Monet[áa]ria(?:\s+Parcela\s*\(\d+\/\d+\))?|Juros)\s+(-?\d.*)$/i;
  const itens:InvoiceDetails['itens']=[];
  for(const line of lines) {
    const m=line.match(itemLabel);if(!m)continue;
    // Em texto com colunas lado a lado, não incorporar a tabela tributária ao item.
    const amountText=m[2].split(/\s+(?:ICMS|PIS|COFINS)\s/i)[0];
    const values=(amountText.match(labelNumber)??[]).map(br);
    if (![1,3,6].includes(values.length)) continue;
    itens.push({descricao:m[1],quantidade:values.length===6?values[0]:null,tarifa_com_tributos:values.length===6?values[1]:null,tarifa_sem_tributos:values.length===6?values[2]:null,pis_cofins:values.length===6?values[3]:values.length===3?values[0]:null,icms:values.length===6?values[4]:values.length===3?values[1]:null,valor:values[values.length-1]});
  }
  const tributos:InvoiceDetails['tributos']=[];
  for(const name of ['ICMS','PIS','COFINS']) {
    const m=n.match(new RegExp(`\\b${name}\\s+([\\d.]+,\\d+)\\s+([\\d.]+,\\d+)\\s+([\\d.]+,\\d+)`,'i'));
    if(m)tributos.push({nome:name,base:br(m[1]),aliquota:br(m[2]),valor:br(m[3])});
  }
  const reading=n.match(/Leitura\s+Anterior\s+Leitura\s+Atual\s+N[ºo°]\s+de\s+Dias\s+Pr[oó]xima\s+Leitura\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+\d+\s+(\d{2}\/\d{2}\/\d{4})/i);
  const docIndex=lines.findIndex(l=>/^CNPJ\s*:/i.test(l));
  const cliente=docIndex>0?lines[docIndex-1]:null;
  const cepIndex=lines.findIndex(l=>/^CEP\s*:/i.test(l));
  const endereco=docIndex>=0 && cepIndex>docIndex?lines.slice(docIndex+1,cepIndex+1).join(' '):null;
  const graph=n.match(/((?:(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/\d{2}\s+){2,})Ativo\s+Injetado\s+((?:\d[\d.,]*\s+){2,})/i);
  const history:InvoiceDetails['historico_ativo_injetado']=[];
  if(graph){const months=graph[1].trim().split(/\s+/);const values=graph[2].trim().split(/\s+/).map(br);if(values.length===months.length*2)months.forEach((mes,i)=>history.push({mes,ativo_kwh:values[i*2],injetado_kwh:values[i*2+1]}));}
  return {cliente,documento:lineValue(/^CNPJ\s*:\s*/i),endereco,
    unidade_consumidora:n.match(/\b\d\.\d{3}\.\d{3}\.\d{3}-\d{2}\b/)?.[0]??null,
    grupo:n.match(/GRUPO\s+DE\s+TENS[ÃA]O:\s*(\S+)/i)?.[1]??null,
    subgrupo:n.match(/SUBGRUPO:\s*(\S+)/i)?.[1]??null,
    classificacao:lineValue(/^CLASSIFICA[ÇC][ÃA]O:\s*/i)?.split(/MODALIDADE/i)[0].trim()??null,
    modalidade:n.match(/MODALIDADE\s+TARIF[ÁA]RIA:\s*(\S+)/i)?.[1]??null,
    fornecimento:n.match(/TIPO\s+DE\s+FORNECIMENTO:\s*(\S+)/i)?.[1]??null,
    vencimento:n.match(/PAG[ÁA]VEL\s+PREFERENCIALMENTE\s+NO\s+BANCO\s+DO\s+BRASIL\s+(\d{2}\/\d{2}\/\d{4})/i)?.[1]??n.match(/\b(?:0[1-9]|1[0-2])\/20\d{2}\s+(\d{2}\/\d{2}\/20\d{2})\s+R\$/)?.[1]??null,
    leitura_anterior:reading?.[1]??null,leitura_atual:reading?.[2]??null,proxima_leitura:reading?.[3]??null,
    perdas_percentual:n.match(/PERDAS\s+DE\s+TRANSFORMA[ÇC][ÃA]O\s*\/\s*RAMAL:\s*([\d.,]+)\s*%/i)?br(n.match(/PERDAS\s+DE\s+TRANSFORMA[ÇC][ÃA]O\s*\/\s*RAMAL:\s*([\d.,]+)\s*%/i)![1]):null,
    itens,tributos,historico_ativo_injetado:history,soma_itens:itens.length?Math.round(itens.reduce((sum,item)=>sum+item.valor,0)*100)/100:null,texto_extraido:text,
  };
}
