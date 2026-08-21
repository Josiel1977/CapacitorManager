import test from 'node:test';
import assert from 'node:assert/strict';
import { readJsonResponse } from '../lib/http-json-response.ts';

test('lê uma resposta JSON válida', async () => {
  const result = await readJsonResponse<{ ok: boolean }>(new Response('{"ok":true}', { status: 200 }), 'Falha.');
  assert.equal(result.ok, true);
});

test('transforma resposta vazia em erro compreensível', async () => {
  await assert.rejects(
    readJsonResponse(new Response('', { status: 500 }), 'Não foi possível analisar.'),
    /resposta vazia \(HTTP 500\)/,
  );
});

test('preserva a mensagem de erro enviada pela API', async () => {
  await assert.rejects(
    readJsonResponse(new Response('{"error":"PDF não reconhecido"}', { status: 422 }), 'Falha.'),
    /PDF não reconhecido/,
  );
});
