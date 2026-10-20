import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTariff,tariffQuery,validDate} from '../lib/aneel-tariffs.ts';
const row={_id:1,DscBaseTarifaria:'Tarifa de Aplicação',DscUnidadeTerciaria:'MWh',VlrTUSD:'151,86',VlrTE:'200,00',SigAgente:'Teste',DscSubGrupo:'A4'};
test('normaliza MWh para kWh, preserva demanda em kW e aceita zero decimal ANEEL',()=>{
 const r=normalizeTariff(row)!;assert.equal(r.unit,'R$/kWh');assert.ok(Math.abs(r.total-0.35186)<1e-10);
 const d=normalizeTariff({...row,DscUnidadeTerciaria:'kW',VlrTUSD:'32,50',VlrTE:',00'})!;assert.equal(d.unit,'R$/kW');assert.equal(d.total,32.5);
});
test('não usa base econômica, valor ausente ou unidade desconhecida',()=>{
 assert.equal(normalizeTariff({...row,DscBaseTarifaria:'Base Econômica'}),null);
 assert.equal(normalizeTariff({...row,VlrTE:''}),null);
 assert.equal(normalizeTariff({...row,DscUnidadeTerciaria:'kVArh'}),null);
});
test('consulta usa filtros estruturados e valida datas reais e subgrupo',()=>{
 const query=tariffQuery("Agente d'água",'A4','2026-07-15');assert.equal(JSON.parse(query.get('filters')!).SigAgente,"Agente d'água");
 assert.equal(validDate('2026-02-30'),false);assert.throws(()=>tariffQuery('Teste','A9','2026-07-15'));assert.throws(()=>tariffQuery('Teste','A4','2026-02-30'));
});
