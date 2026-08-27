import test from 'node:test';
import assert from 'node:assert/strict';
import { paginateBalanced } from '../lib/balanced-pagination.ts';

test('evita uma última página com apenas um item', () => {
  const pages = paginateBalanced(Array.from({ length: 12 }, (_, index) => index + 1), 11);

  assert.deepEqual(pages.map(page => page.length), [6, 6]);
  assert.deepEqual(pages.flat(), Array.from({ length: 12 }, (_, index) => index + 1));
});

test('mantém todos os itens dentro do limite configurado', () => {
  const pages = paginateBalanced(Array.from({ length: 37 }, (_, index) => index), 18);

  assert.deepEqual(pages.map(page => page.length), [13, 12, 12]);
  assert.ok(pages.every(page => page.length <= 18));
});

test('não cria páginas para uma coleção vazia', () => {
  assert.deepEqual(paginateBalanced([], 18), []);
});
