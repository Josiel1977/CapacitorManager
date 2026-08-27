import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('visitante recebe uma página de valor antes do painel demonstrativo', () => {
  const home = source('app/page.tsx');
  const landing = source('components/PublicLanding.tsx');
  assert.match(home, /isAuthenticated \? <DashboardReal \/> : <PublicLanding \/>/);
  assert.match(landing, /Analisar uma fatura grátis/);
  assert.match(landing, /Ver relatório de exemplo/);
  assert.doesNotMatch(home, /DashboardDemo/);
});

test('jornada pública separa diagnóstico, contato e contratação', () => {
  const header = source('components/PublicHeader.tsx');
  const sidebar = source('components/Sidebar.tsx');
  assert.match(header, /href: '\/demo', label: 'Analisar fatura'/);
  assert.match(header, /href: '\/contato', label: 'Falar com especialista'/);
  assert.match(sidebar, /Solicitar Demo', href: '\/contato'/);
  assert.doesNotMatch(sidebar, /Solicitar Demo', href: '\/signup'/);
});

test('demonstração começa pela fatura e não oferece destravamento artificial', () => {
  const demo = source('app/demo/page.tsx');
  assert.match(demo, /useState<'capacitor' \| 'fatura'>\('fatura'\)/);
  assert.match(demo, /Nenhum cadastro é necessário/);
  assert.doesNotMatch(demo, /Resetar Testes \(Destravar\)/);
});

test('páginas públicas não anunciam materiais inexistentes', () => {
  const guide = source('app/como-usar/page.tsx');
  const help = source('app/ajuda/page.tsx');
  assert.match(guide, /mx-auto max-w-7xl space-y-8 px-4/);
  assert.doesNotMatch(guide, /Em breve: tutorial completo em vídeo/);
  assert.doesNotMatch(guide, /guia-capacitormanager\.pdf/);
  assert.doesNotMatch(help, /Em breve: mais vídeos/);
});

test('piloto assistido é a opção inicial e relatório é identificado como demonstrativo', () => {
  const contact = source('app/contato/page.tsx');
  const report = source('app/relatorio-exemplo/page.tsx');
  assert.match(contact, /plano_interesse: 'piloto'/);
  assert.match(contact, /Piloto Assistido/);
  assert.match(contact, /diretamente ao responsável técnico/);
  assert.doesNotMatch(contact, /Nossa equipe/);
  assert.match(report, /Cenário demonstrativo com dados fictícios/);
  assert.match(report, /Aplicar aos meus dados/);
});
