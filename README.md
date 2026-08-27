# CapacitorManager

Aplicação SaaS multiempresa para cadastro de clientes e bancos de capacitores, registro de medições, auditoria assistida de faturas e dimensionamento com memória de cálculo.

## Requisitos

- Node.js 20 LTS
- Projeto Supabase separado para homologação e produção
- Conta Mercado Pago com planos recorrentes e assinatura de webhook
- Resend e DeepSeek são opcionais

## Execução local

1. Copie `.env.example` para `.env.local` e preencha os valores.
2. Instale de forma reproduzível: `npm ci`.
3. Rode `npm test`, `npm run lint` e `npm run build`.
4. Inicie com `npm run dev`.

Nunca envie `.env.local`, chaves Supabase administrativas, tokens Mercado Pago ou chaves de IA ao navegador ou ao repositório.

## Banco de dados

As migrações ficam em `supabase/migrations`. Antes de aplicá-las, execute os diagnósticos em `supabase/diagnostics` e faça um backup restaurável. A migração `202608200001_production_hardening.sql` encerra permissões legadas, aplica RLS multiempresa, limites de plano, vínculo entre registros, rate limit e ciclo idempotente de webhooks.

## Limites comerciais vigentes

| Plano | Mensalidade | Clientes | Bancos | Capacitores |
|---|---:|---:|---:|---:|
| Básico | R$ 149 | 1 | 1 | 6 |
| Essencial | R$ 297 | 5 | 10 | 50 |
| Pro | R$ 597 | 20 | 20 | 200 |
| Master | R$ 797 | 50 | 100 | 600 |

A fonte única desses dados é `lib/plans.ts`; não duplique valores em novas telas.

## Observação técnica

Faturas geram somente pré-dimensionamento. Campanhas temporais podem liberar uma especificação condicionada apenas quando os critérios de qualidade e as validações de engenharia forem atendidos. Nenhum resultado substitui medição em campo, projeto, laudo, ART/TRT ou decisão de profissional habilitado. Consulte `docs/RC23.md`, `docs/DEPLOYMENT_CHECKLIST.md` e `docs/PRODUCTION_READINESS.md` antes de liberar vendas.
