import test from 'node:test';
import assert from 'node:assert/strict';
import {createConsultancyPdf} from '../lib/consultancy-pdf.ts';
test('relatório incorpora fonte legível em português e pagina texto extenso',async()=>{
 const pdf=await createConsultancyPdf(['CONSULTORIA E GESTÃO TARIFÁRIA',...Array.from({length:90},()=> 'Demanda contratada, energia injetada e reativo: premissas, fontes e validação técnica. Cálculo 2 × tarifa.')]);
 assert.ok(pdf.getNumberOfPages()>1);assert.match(pdf.output(),/FontFile2/);assert.ok(pdf.output().startsWith('%PDF-'));
});
