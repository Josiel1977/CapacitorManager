import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const icon = readFileSync(new URL('../app/icon.svg', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');

test('favicon usa o símbolo e as cores do CapacitorManager', () => {
  assert.match(icon, /<svg/);
  assert.match(icon, /#0a2b3c/i);
  assert.match(icon, /#f39c12/i);
  assert.match(icon, /aria-label="CapacitorManager"/);
  assert.match(layout, /icon: '\/icon\.svg'/);
  assert.doesNotMatch(layout, /favicon\.ico/);
});
