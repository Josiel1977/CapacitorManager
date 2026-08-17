# Checklist de implantação segura

## 1. Antes do banco

- Criar um projeto de homologação ou backup verificável.
- Executar `supabase/diagnostics/tenant_readiness.sql`.
- Corrigir todos os itens `CORRIGIR` e mapear tabelas `AUSENTE`.
- Confirmar que cada perfil possui o `tenant_id` correto.
- Confirmar que clientes, bancos, capacitores e medições pertencem à mesma empresa.

## 2. Migrações

- Executar primeiro `202608110002_payment_events.sql`.
- Executar `202608110001_foundation_security.sql` somente após o diagnóstico ficar sem pendências.
- Validar login de administrador, usuário comum e tentativa de acesso cruzado entre empresas.

## 3. Vercel

- Configurar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Configurar `SUPABASE_SERVICE_ROLE_KEY` somente no servidor.
- Configurar `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`.
- Configurar os quatro IDs `MP_PLAN_*`.
- Confirmar `NEXT_PUBLIC_APP_URL=https://www.capacitormanager.com.br`.
- Realizar novo deploy e testar `/api/health`.

## 4. Mercado Pago

- Manter apenas uma URL oficial de webhook no painel.
- Durante a transição, os dois endpoints antigos continuam compatíveis.
- Simular pagamento aprovado, recusado, cancelado e evento repetido.
- Confirmar que evento repetido não produz nova alteração.

## 5. Aprovação

- Testar relatório de dois tenants diferentes.
- Validar limites de todos os planos.
- Registrar data, responsável e resultado da implantação.
