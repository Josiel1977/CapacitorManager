import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {newReportProfessional,parseReportProfessional,professionalReportLines} from '../lib/report-professional.ts';
import {createConsultancyPdf} from '../lib/consultancy-pdf.ts';
function crc(data:Buffer){let c=0xffffffff;for(const byte of data){c^=byte;for(let bit=0;bit<8;bit++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type:string,data:Buffer){const name=Buffer.from(type),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([size,name,data,sum]);}
function png(){const head=Buffer.alloc(13);head.writeUInt32BE(1,0);head.writeUInt32BE(1,4);head[8]=8;head[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(Buffer.from([0,0,0,0,255]))),chunk('IEND',Buffer.alloc(0))]);}
test('identificação usa nome e formação informados sem inventar número de registro',()=>{
 const profile=newReportProfessional();assert.equal(profile.name,'Josiel Maia');assert.equal(profile.title,'Eletrotécnico');assert.equal(profile.registration,'');assert.equal(profile.signatureDataUrl,null);
 assert.match(professionalReportLines(profile).join('\n'),/CRT\/CFT: número não informado/);
 assert.match(professionalReportLines(profile).join('\n'),/Situação declarada/);
});
test('perfil inválido ou imagem de outra origem não entra nos relatórios',()=>{
 const profile=newReportProfessional();
 for(const signatureDataUrl of ['https://example.com/a.png','data:image/svg+xml;base64,PHN2Zz4=','javascript:alert(1)'])assert.throws(()=>parseReportProfessional({...profile,signatureDataUrl,signatureWidth:100,signatureHeight:100}));
 assert.throws(()=>parseReportProfessional({...profile,name:'x'.repeat(161)}));
 assert.throws(()=>parseReportProfessional({...profile,signatureDataUrl:'data:image/png;base64,AAAA',signatureWidth:0,signatureHeight:100}));
});
test('sem identificação preenchida não fabrica um responsável',()=>{
 assert.deepEqual(professionalReportLines({...newReportProfessional(),name:'',registration:'',title:'',status:''}),[]);
 assert.deepEqual(professionalReportLines(),[]);
});
test('perfil restaurado conserva assinatura válida e ignora campos extras',()=>{
 const profile={...newReportProfessional(),registration:'CRT-TESTE',signatureDataUrl:'data:image/png;base64,'+png().toString('base64'),signatureWidth:1,signatureHeight:1};
 const restored=parseReportProfessional(JSON.parse(JSON.stringify({...profile,extra:'ignorar'})));
 assert.equal(restored.registration,'CRT-TESTE');assert.equal(restored.signatureDataUrl,profile.signatureDataUrl);assert.ok(!('extra' in restored));
});
test('PDF pagina conteúdo extenso e incorpora a assinatura e identificação no final',async()=>{
 const profile={...newReportProfessional(),name:'Profissional Teste',registration:'CRT-TESTE',signatureDataUrl:'data:image/png;base64,'+png().toString('base64'),signatureWidth:1,signatureHeight:1};
 const pdf=await createConsultancyPdf(['RELATÓRIO DE TESTE',...Array.from({length:110},()=> 'Consumo e demanda: premissas de teste sintético, sem dados de cliente.')],profile);
 assert.ok(pdf.getNumberOfPages()>1);assert.match(pdf.output(),/\/Subtype \/Image/);assert.match(pdf.output(),/FontFile2/);
});
