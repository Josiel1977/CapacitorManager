import test from 'node:test';
import assert from 'node:assert/strict';
import { isProtectedPath } from '../lib/route-protection.ts';

test('login, cadastro e demonstração permanecem públicos', () => {
  assert.equal(isProtectedPath('/login'), false);
  assert.equal(isProtectedPath('/signup'), false);
  assert.equal(isProtectedPath('/demo'), false);
  assert.equal(isProtectedPath('/'), false);
});

test('rotas privadas e seus subcaminhos exigem autenticação', () => {
  assert.equal(isProtectedPath('/dashboard-real'), true);
  assert.equal(isProtectedPath('/clientes'), true);
  assert.equal(isProtectedPath('/clientes/empresa-1'), true);
  assert.equal(isProtectedPath('/admin/usuarios'), true);
});

test('prefixos parecidos não são classificados como área privada', () => {
  assert.equal(isProtectedPath('/clientessobre'), false);
  assert.equal(isProtectedPath('/admin-publico'), false);
});
