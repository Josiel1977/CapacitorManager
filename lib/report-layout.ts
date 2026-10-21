/** Section labels must contain letters; numeric history rows are body text. */
export function isReportHeading(text:string){
 return /[A-ZÀ-Ý]/.test(text)&&text===text.toLocaleUpperCase('pt-BR')&&text.length<180;
}

/** Keep consecutive history and tax rows together without losing their values. */
export function groupReportLines(lines:string[]):string[]{
 const result:string[]=[];
 const category=(text:string)=>/^(?:ICMS|PIS|COFINS): base /.test(text)?'tax':/^(?:\d{2}\/\d{4}|[A-Z]{3}\/\d{2}): /.test(text)?'history':null;
 for(let index=0;index<lines.length;index++){
  const text=lines[index];
  if(text==='Histórico de demanda por mês (ponta / fora de ponta):'&&category(lines[index+1]??'')==='history'){
   const rows=[text];while(index+1<lines.length&&category(lines[index+1])==='history')rows.push(lines[++index]);result.push(rows.join('\n'));continue;
  }
  const kind=category(text);
  if(!kind||text.includes('\n')){result.push(text);continue;}
  const rows=[text];
  while(index+1<lines.length&&category(lines[index+1])===kind&&!lines[index+1].includes('\n'))rows.push(lines[++index]);
  result.push(rows.join('\n'));
 }
 return result;
}
