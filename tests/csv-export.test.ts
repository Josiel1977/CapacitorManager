import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCsv, escapeCsvCell } from '../lib/csv-export.ts';

test('escapa aspas e separadores no CSV', () => {
  assert.equal(escapeCsvCell('Banco; "Principal"'), '"Banco; ""Principal"""');
});

test('neutraliza fórmulas perigosas para planilhas', () => {
  assert.equal(escapeCsvCell('=HYPERLINK("https://exemplo")'), '"\'=HYPERLINK(""https://exemplo"")"');
  assert.equal(escapeCsvCell('+CMD'), '"\'+CMD"');
});

test('gera CSV compatível com Excel em português', () => {
  assert.equal(buildCsv(['Nome', 'Valor'], [['Capacitor A', 10]]), '"Nome";"Valor"\r\n"Capacitor A";"10"');
});
