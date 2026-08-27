# Relatório de verificação — 1.0.0-rc.3

Data: 20/08/2026

## Resultado automatizado

| Verificação | Resultado |
|---|---|
| Instalação reproduzível (`npm ci`) | Aprovada |
| Testes de domínio e parsers | 41 aprovados, 0 falhas |
| TypeScript (`tsc --noEmit`) | 0 erros |
| ESLint | 0 erros; 232 avisos legados não bloqueadores |
| Build Next.js 16.3.1/webpack | Aprovado; 44 páginas geradas |
| Auditoria npm de dependências de produção | 0 vulnerabilidades conhecidas |
| Auditoria npm completa, incluindo ferramentas de desenvolvimento | 0 vulnerabilidades conhecidas |

## Smoke test local do artefato standalone

- Página inicial: HTTP 200.
- Login: HTTP 200.
- Rota autenticada sem sessão: HTTP 307 para `/login`.
- CSP, HSTS, `nosniff`, anti-frame, política de permissões e isolamento de origem presentes.
- `/api/health` respondeu 503/degraded com credenciais fictícias, comportamento esperado; a aprovação em homologação exige HTTP 200 com o Supabase real.

## Escopo conferido

- Isolamento multiempresa e bloqueio de assinatura em RLS e proxy.
- Cadastro, login, recuperação de senha e proteção administrativa.
- Timeout seguro da autenticação: páginas públicas não ficam presas quando o Supabase está indisponível; áreas privadas falham fechadas.
- Página inicial e menu público renderizam imediatamente, sem depender da consulta de sessão.
- Checkout autenticado e webhook Mercado Pago assinado e idempotente.
- Rate limit atômico no banco para cadastro, leads, chat, auditoria e checkout.
- Validação de leads e consentimento de privacidade.
- Auditoria de PDF sem armazenamento pelo endpoint.
- Fórmulas de corrente considerando tensão e frequência medidas.
- Dimensionamento, projeção prudente e limites comerciais centralizados.

## Condição de liberação

Este relatório valida o pacote de código. A venda só deve ser liberada depois de concluir os bloqueios externos de `PRODUCTION_READINESS.md` e registrar o go/no-go de `DEPLOYMENT_CHECKLIST.md`.
