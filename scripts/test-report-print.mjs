import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import {setTimeout} from 'node:timers/promises';
import 'pdf-parse/worker';
import {PDFParse} from 'pdf-parse';
import {chromium} from 'playwright';
import {parseEquatorialInvoiceText} from '../lib/equatorial-invoice-parser.ts';
import {buildInvoiceAuditResult} from '../lib/invoice-audit-result.ts';
function crc(data){let c=0xffffffff;for(const byte of data){c^=byte;for(let bit=0;bit<8;bit++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([size,name,data,sum]);}
function png(){const head=Buffer.alloc(13);head.writeUInt32BE(1,0);head.writeUInt32BE(1,4);head[8]=8;head[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(Buffer.from([0,0,0,0,255]))),chunk('IEND',Buffer.alloc(0))]);}
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3100'],{env:process.env,stdio:['ignore','pipe','pipe']});
let output='';server.stdout.on('data',data=>output+=data);server.stderr.on('data',data=>output+=data);
let browser;
async function inspectPdf(buffer,label){const parser=new PDFParse({data:buffer});try{const result=await parser.getText();assert.match(result.text,/Profissional Teste/);assert.match(result.text,/CRT-TESTE-0000/);assert.match(result.text,/CLIENTE SINTETICO TESTE/);assert.ok(result.pages.every(page=>page.text.replace(/\s/g,'').length>30),label+': página em branco');assert.ok(!result.text.includes('Salvar dados e assinatura neste navegador'),label+': formulário impresso');console.log(label+': '+result.pages.length+' páginas com conteúdo e identificação.');}finally{await parser.destroy();}}
try{
 let ready=false;for(let n=0;n<60;n++){try{if((await fetch('http://localhost:3100/auditoria')).ok){ready=true;break;}}catch{}await setTimeout(1000);}assert.ok(ready,'Servidor não iniciou: '+output.slice(-2000));
 await mkdir('artifacts/report-print',{recursive:true});
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:1000}});
 await page.goto('http://localhost:3100/auditoria');
 const invoice=buildInvoiceAuditResult(parseEquatorialInvoiceText(`Equatorial Pará Referência: 08/2026 Total a Pagar R$ 1.000,00
GRUPO DE TENSÃO: B SUBGRUPO: B3
CLASSIFICAÇÃO: COMERCIAL B-OPTANTE
CLIENTE SINTETICO TESTE
CNPJ: **.***.000/000*-**
1.000.000.001-01
Consumo (kWh) 100 1,000000 0,800000 1,00 19,00 100,00
Consumo Compensado (kWh) 20 1,000000 0,800000 1,00 19,00 20,00
Energia Ativa Injetada (kWh) 30 1,000000 0,800000 -1,00 -19,00 -30,00
Consumo Reativo Excedente (kVAr) 10 0,500000 0,400000 0,00 0,00 5,00
Multa 1,00`));
 await page.route('**/api/capacitormanager/auditar-fatura',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:invoice})}));
 await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles({name:'fatura-sintetica.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 fixture')});
 await page.getByRole('button',{name:'Analisar fatura',exact:true}).click();
 await page.getByRole('heading',{name:'Resultado da fatura enviada',exact:true}).waitFor();
 await page.getByLabel('Geração dos inversores, cargas previstas, medições e recomendações',{exact:true}).fill('Observações técnicas sintéticas para testar paginação. '.repeat(160));
 await page.getByLabel('Nome do responsável',{exact:true}).fill('Profissional Teste');
 await page.getByLabel('Número do CRT/CFT e regional',{exact:true}).fill('CRT-TESTE-0000');
 await page.getByLabel('Imagem da assinatura',{exact:true}).setInputFiles({name:'assinatura-sintetica.png',mimeType:'image/png',buffer:png()});
 await page.getByRole('status').filter({hasText:'Assinatura adicionada'}).waitFor();
 for(const [label,file] of [['Auditoria da fatura','auditoria'],['Consultoria e Gestão Tarifária','consultoria'],['Expansão e transformadores','expansao']]){
  await page.emulateMedia({media:'screen'});await page.getByRole('button',{name:label,exact:true}).click();
  await page.emulateMedia({media:'print'});
  const data=await page.pdf({path:'artifacts/report-print/'+file+'.pdf',preferCSSPageSize:true,printBackground:true});
  await inspectPdf(data,label);
  await page.screenshot({path:'artifacts/report-print/'+file+'.png',fullPage:true});
 }
 await page.emulateMedia({media:'screen'});
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar estudo de expansão PDF',exact:true}).click();
 const download=await downloadPromise;await download.saveAs('artifacts/report-print/expansao-download.pdf');
 const direct=await readFile('artifacts/report-print/expansao-download.pdf');
 await inspectPdf(direct,'PDF direto');assert.match(direct.toString('latin1'),/\/Subtype \/Image/);
 console.log('Impressão das três áreas e PDF direto verificados, incluindo assinatura sintética.');
}catch(error){console.error(output.slice(-2000));throw error;}
finally{if(browser)await browser.close();server.kill('SIGTERM');}
