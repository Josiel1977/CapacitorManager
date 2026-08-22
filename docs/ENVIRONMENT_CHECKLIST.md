# Contrato de ambiente do CapacitorManager

Nunca copie `.env.local` para ZIP, GitHub ou mensagens. Na Vercel, os nomes são
sensíveis a maiúsculas e minúsculas e os valores não devem conter espaços ou
quebras de linha no início ou no fim.

## Obrigatórias em todos os ambientes

| Variável | Escopo | Regra |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Pública | URL HTTPS canônica do ambiente |
| `NEXT_PUBLIC_SUPABASE_URL` | Pública | URL HTTPS do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública | Chave pública/anon do mesmo projeto |
| `SUPABASE_SECRET_KEY` | Servidor | Chave secreta do mesmo projeto; nunca usar `NEXT_PUBLIC_` |
| `RATE_LIMIT_SALT` | Servidor | Valor aleatório exclusivo com pelo menos 32 caracteres |

`SUPABASE_SERVICE_ROLE_KEY` continua aceito temporariamente como nome legado.
Configure apenas um dos dois nomes administrativos para evitar ambiguidades.

## Obrigatórias antes da comercialização

| Variável | Escopo |
| --- | --- |
| `MP_ACCESS_TOKEN` | Servidor |
| `MP_WEBHOOK_SECRET` | Servidor |
| `MP_PLAN_BASICO` | Servidor |
| `MP_PLAN_ESSENCIAL` | Servidor |
| `MP_PLAN_PRO` | Servidor |
| `MP_PLAN_MASTER` | Servidor |

`MERCADO_PAGO_ACCESS_TOKEN` é aceito apenas como compatibilidade legada.

## Opcionais

`DEEPSEEK_API_KEY`, `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` e
`CONTACT_TO_EMAIL` habilitam IA e notificações, mas não devem bloquear o núcleo
técnico quando ausentes.

## Gate de validação

1. Salvar as variáveis no escopo correto da Vercel.
2. Fazer novo deploy; alterações não modificam deploys já concluídos.
3. Abrir `/api/health` no Preview.
4. Exigir `authentication`, `privilegedDatabase`, `abuseProtection` e
   `payments` com estado `ok` antes de promover a release.
5. No ambiente Production, o endpoint não detalha capacidades individuais.
