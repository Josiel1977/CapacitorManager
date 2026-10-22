import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import {setTimeout} from 'node:timers/promises';
import 'pdf-parse/worker';
import {PDFParse} from 'pdf-parse';
import {createRequire} from 'node:module';
const {chromium}=createRequire('/tmp/cm-report-print-tools/package.json')('playwright');
import {parseEquatorialInvoiceText} from '../lib/equatorial-invoice-parser.ts';
import {buildInvoiceAuditResult} from '../lib/invoice-audit-result.ts';
function crc(data){let c=0xffffffff;for(const byte of data){c^=byte;for(let bit=0;bit<8;bit++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([size,name,data,sum]);}
function png(){const head=Buffer.alloc(13);head.writeUInt32BE(1,0);head.writeUInt32BE(1,4);head[8]=8;head[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(Buffer.from([0,0,0,0,255]))),chunk('IEND',Buffer.alloc(0))]);}
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3100'],{env:process.env,stdio:['ignore','pipe','pipe']});
let output='';server.stdout.on('data',data=>output+=data);server.stderr.on('data',data=>output+=data);
let browser;
async function inspectPdf(buffer,label){const parser=new PDFParse({data:buffer});try{const result=await parser.getText();assert.match(result.text,/Profissional Teste/);assert.match(result.text,/CRT-TESTE-0000/);assert.ok(!result.text.includes('Prévia — data definida'),label+': data de impressão não atualizada');assert.match(result.text,/CLIENTE SINTETICO TESTE/);assert.ok(result.pages.every(page=>page.text.replace(/\s/g,'').length>30),label+': página em branco');assert.ok(!result.text.includes('Salvar dados e assinatura neste navegador'),label+': formulário impresso');console.log(label+': '+result.pages.length+' páginas com conteúdo e identificação.');return result.text;}finally{await parser.destroy();}}
try{
 let ready=false;for(let n=0;n<60;n++){try{if((await fetch('http://localhost:3100/auditoria',{signal:AbortSignal.timeout(5000)})).ok){ready=true;break;}}catch{}await setTimeout(1000);}assert.ok(ready,'Servidor não iniciou: '+output.slice(-2000));
 await mkdir('artifacts/report-print',{recursive:true});
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:1000}});
 page.on('pageerror',error=>console.error('Erro de página:',error.message));
 page.on('console',message=>{if(message.type()==='error')console.error('Console:',message.text());});
 await page.goto('http://localhost:3100/auditoria');
 await page.getByRole('button',{name:'Expansão e transformadores',exact:true}).click();
 await page.getByRole('heading',{name:'Expansão de carga e transformadores',exact:true}).waitFor();
 await page.getByRole('button',{name:'Auditoria da fatura',exact:true}).click();
 const invoice=buildInvoiceAuditResult(parseEquatorialInvoiceText(`Equatorial Pará Referência: 08/2026 Total a Pagar R$ 96,00
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
 invoice.detalhes_fatura.leitura_atual='03/08/2026';
 const aneelRequests=[];
 const actualA4Rows=JSON.parse(await readFile('tests/fixtures/aneel-equatorial-pa-a4-2026-07.json','utf8'));
 await page.route('**/api/tarifas-aneel?**',route=>{aneelRequests.push(route.request().url());return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({tariffs:new URL(route.request().url()).searchParams.get('subgroup')==='A4'?actualA4Rows:[],consultedAt:'2026-08-03T12:00:00Z',rejected:0})});});
 await page.route('**/api/capacitormanager/auditar-fatura',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:invoice})}));
 await page.locator('input[type="file"][accept="application/pdf,.pdf"]:visible').setInputFiles({name:'fatura-sintetica.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 fixture')});
 await page.getByRole('button',{name:'Analisar fatura',exact:true}).click();
 await page.getByRole('heading',{name:'Resultado da fatura enviada',exact:true}).waitFor();
 const currentScenario=page.getByRole('group',{name:'B-optante',exact:true});
 assert.equal(await currentScenario.getByLabel('Energia monômia (R$/kWh)',{exact:true}).inputValue(),'1');
 assert.equal(await currentScenario.getByLabel('Demais custos recorrentes (R$/mês)',{exact:true}).inputValue(),'5');
 const alternativeScenario=page.getByRole('group',{name:'A-verde',exact:true});
 assert.equal(await alternativeScenario.getByLabel('Demais custos recorrentes (R$/mês)',{exact:true}).inputValue(),'');
 await currentScenario.getByLabel('Demais custos recorrentes (R$/mês)',{exact:true}).fill('7');
 await page.getByRole('button',{name:'Preencher campos vazios com a fatura',exact:true}).click();
 assert.equal(await currentScenario.getByLabel('Demais custos recorrentes (R$/mês)',{exact:true}).inputValue(),'7');
 console.log('Preenchimento da fatura confirmado: cenário atual, alternativas pendentes e edição manual preservada.');
 await page.getByLabel('Geração dos inversores, cargas previstas, medições e recomendações').fill('Observações técnicas sintéticas para testar paginação. '.repeat(160));
 await page.getByLabel('Nome do responsável',{exact:true}).fill('Profissional Teste');
 await page.getByLabel('Número do CRT/CFT e regional',{exact:true}).fill('CRT-TESTE-0000');
 await page.getByLabel('Imagem da assinatura',{exact:true}).setInputFiles({name:'assinatura-sintetica.png',mimeType:'image/png',buffer:png()});
 await page.getByRole('status').filter({hasText:'Assinatura adicionada'}).waitFor();
 for(const [label,file] of [['Auditoria da fatura','auditoria'],['Consultoria e Gestão Tarifária','consultoria'],['Expansão e transformadores','expansao']]){
  await page.emulateMedia({media:'screen'});await page.getByRole('button',{name:label,exact:true}).click();
  if(file==='consultoria'){
   await page.getByRole('button',{name:'Buscar tarifas',exact:true}).waitFor();
   assert.equal(await page.getByLabel('Distribuidora do catálogo ANEEL',{exact:true}).inputValue(),'EQUATORIAL PA');
   assert.equal(await page.getByLabel('Subgrupo do catálogo ANEEL',{exact:true}).inputValue(),'B3');
   assert.equal(await page.getByLabel('Data de referência do catálogo ANEEL',{exact:true}).inputValue(),'2026-08-03');
   assert.ok(aneelRequests.some(value=>{const params=new URL(value).searchParams;return params.get('agent')==='EQUATORIAL PA'&&params.get('subgroup')==='B3'&&params.get('date')==='2026-08-03';}),'Consulta ANEEL não iniciada automaticamente com os dados da fatura.');
   console.log('Leitura da fatura prepara filtros e inicia consulta ANEEL automaticamente.');
   const currentTariff=page.getByRole('group',{name:'Convencional',exact:true});
   assert.equal(await currentTariff.getByLabel('Energia única / fora (R$/kWh)',{exact:true}).inputValue(),'0.8');
   const reference=currentTariff.locator('input[type="date"]');assert.equal(await reference.inputValue(),'');
   await page.getByRole('checkbox',{name:'Permitir substituir o estudo atual pela importação.',exact:true}).check();
   await page.getByRole('button',{name:'Importar dados identificados na fatura analisada',exact:true}).click();
   await page.getByRole('status').filter({hasText:'1 valor(es) tarifário(s)'}).waitFor();
   assert.equal(await currentTariff.getByLabel('Energia única / fora (R$/kWh)',{exact:true}).inputValue(),'0.8');
   console.log('Consultoria importa tarifa sem tributos, informa pendências e não inventa data de referência.');
   await page.getByLabel('Enquadramento',{exact:true}).selectOption('A4');
   await page.getByLabel('Subgrupo do catálogo ANEEL',{exact:true}).selectOption('A4');
   await page.getByRole('button',{name:'Buscar tarifas',exact:true}).click();
   await page.getByRole('status').filter({hasText:'Referências completas disponíveis: Verde e Azul'}).waitFor();
   for(const [name,peak,demand] of [['Horária Verde','3.02115',null],['Horária Azul','0.59043','100.12']]){
    const group=page.getByRole('group',{name,exact:true});
    await group.getByLabel('Energia ponta (R$/kWh)',{exact:true}).waitFor();
    assert.equal(await group.getByLabel('Energia ponta (R$/kWh)',{exact:true}).inputValue(),peak);
    assert.equal(await group.getByLabel('Energia única / fora (R$/kWh)',{exact:true}).inputValue(),'0.42079');
    assert.equal(await group.getByLabel('Demanda única / fora (R$/kW)',{exact:true}).inputValue(),'44.81');
    if(demand)assert.equal(await group.getByLabel('Demanda ponta (R$/kW)',{exact:true}).inputValue(),demand);
    assert.equal(await group.locator('input[type="date"]').inputValue(),'2026-08-03');
    assert.equal(await group.getByRole('checkbox').isChecked(),false);
   }
   const green=page.getByRole('group',{name:'Horária Verde',exact:true});
   await green.getByLabel('Energia única / fora (R$/kWh)',{exact:true}).fill('0.99');
   await page.getByRole('button',{name:'Buscar tarifas',exact:true}).click();
   await page.getByRole('status').filter({hasText:'Referências completas disponíveis: Verde e Azul'}).waitFor();
   assert.equal(await green.getByLabel('Energia única / fora (R$/kWh)',{exact:true}).inputValue(),'0.99');
   console.log('Resposta real ANEEL preenche as sete tarifas Verde/Azul, fonte e data; preserva edição manual e mantém revisão pendente.');
   const example=page.getByRole('heading',{name:'Ampliação: um transformador maior ou dois transformadores?',exact:true});
   for(const subgroup of ['A1','A2','A3','A3a','A4','AS']){
    await page.getByLabel('Enquadramento',{exact:true}).selectOption(subgroup);
    assert.equal(await example.count(),0,'Grupo A não deve exibir exemplo de migração');
    assert.equal(await page.getByRole('button',{name:'Adicionar roteiro às observações do estudo',exact:true}).count(),0);
   }
   await page.getByLabel('Enquadramento',{exact:true}).selectOption('A4');
   await page.emulateMedia({media:'print'});
   const groupA=await page.pdf({path:'artifacts/report-print/consultoria-grupo-a.pdf',preferCSSPageSize:true,printBackground:true});
   const groupAText=await inspectPdf(groupA,'Consultoria Grupo A');
   assert.ok(!groupAText.includes('AMPLIAÇÃO E MEDIÇÃO'));
   assert.ok(!groupAText.includes('um transformador atual de 112,5'));
   await page.emulateMedia({media:'screen'});
   for(const subgroup of ['B3','B-optante']){
    await page.getByLabel('Enquadramento',{exact:true}).selectOption(subgroup);
    await example.waitFor({state:'visible'});
   }
  }
  await page.emulateMedia({media:'print'});
  const data=await page.pdf({path:'artifacts/report-print/'+file+'.pdf',preferCSSPageSize:true,printBackground:true});
  await inspectPdf(data,label);
  await page.screenshot({path:'artifacts/report-print/'+file+'.png',fullPage:true});
 }
 await page.emulateMedia({media:'screen'});
 await page.getByRole('button',{name:'Auditoria da fatura',exact:true}).click();
 const auditDownloadPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'Gerar e baixar relatório PDF',exact:true}).click();
 const auditDownload=await auditDownloadPromise;
 await auditDownload.saveAs('artifacts/report-print/auditoria-download.pdf');
 await inspectPdf(await readFile('artifacts/report-print/auditoria-download.pdf'),'PDF direto da auditoria');
 await page.getByRole('button',{name:'Expansão e transformadores',exact:true}).click();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar estudo de expansão PDF',exact:true}).click();
 const download=await downloadPromise;await download.saveAs('artifacts/report-print/expansao-download.pdf');
 const direct=await readFile('artifacts/report-print/expansao-download.pdf');
 await inspectPdf(direct,'PDF direto');assert.match(direct.toString('latin1'),/\/Subtype \/Image/);
 const autoPage=await browser.newPage();
 const groupA=structuredClone(invoice);groupA.detalhes_fatura.grupo='A';groupA.detalhes_fatura.subgrupo='A4';groupA.detalhes_fatura.modalidade='A4_LVVD';groupA.detalhes_fatura.itens=[];groupA.contexto_energetico.b_optante=false;
 await autoPage.route('**/api/capacitormanager/auditar-fatura',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:groupA})}));
 await autoPage.route('**/api/tarifas-aneel?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({tariffs:actualA4Rows,consultedAt:'2026-08-03T12:00:00Z',rejected:0})}));
 await autoPage.goto('http://localhost:3100/auditoria');
 await autoPage.locator('input[type="file"][accept="application/pdf,.pdf"]:visible').setInputFiles({name:'grupo-a.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 fixture')});
 await autoPage.getByRole('button',{name:'Analisar fatura',exact:true}).click();
 await autoPage.getByRole('heading',{name:'Resultado da fatura enviada',exact:true}).waitFor();
 await autoPage.getByRole('button',{name:'Consultoria e Gestão Tarifária',exact:true}).click();
 const autoGreen=autoPage.getByRole('group',{name:'Horária Verde',exact:true});
 await autoPage.waitForFunction(()=>document.querySelector('fieldset input[type="number"]')!==null);
 await autoPage.getByRole('status').filter({hasText:'Referências completas disponíveis: Verde e Azul'}).waitFor();
 assert.equal(await autoGreen.getByLabel('Energia ponta (R$/kWh)',{exact:true}).inputValue(),'3.02115');
 await autoPage.getByRole('checkbox',{name:'Permitir substituir o estudo atual pela importação.',exact:true}).check();
 await autoPage.getByRole('button',{name:'Importar dados identificados na fatura analisada',exact:true}).click();
 await autoPage.getByRole('status').filter({hasText:'Referências completas disponíveis: Verde e Azul'}).waitFor();
 assert.equal(await autoGreen.getByLabel('Energia ponta (R$/kWh)',{exact:true}).inputValue(),'3.02115');
 console.log('Fatura A4_LVVD inicia consulta e preenche referências Verde/Azul sem clique; reimportação também recupera as referências sem presumir modalidade contratual.');
 await autoPage.close();
 console.log('Impressão das três áreas e PDF direto verificados, incluindo assinatura sintética.');
}catch(error){console.error(output.slice(-2000));throw error;}
finally{if(browser)await browser.close();server.kill('SIGTERM');}
