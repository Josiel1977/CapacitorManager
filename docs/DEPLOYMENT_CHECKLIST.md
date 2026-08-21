# Checklist de implantação segura

Não abra o checkout de produção antes de todos os itens críticos estarem concluídos e registrados.

## 1. Segredos e contas

- Trocar imediatamente a senha que apareceu na antiga tela de login e encerrar sessões existentes dessa conta.
- Gerar chaves novas de Supabase e Mercado Pago caso tenham circulado fora do cofre de segredos.
- Configurar todas as variáveis de `.env.example` no ambiente de hospedagem; `RATE_LIMIT_SALT` deve ser aleatório, secreto e ter 32+ caracteres.
- Usar `SUPABASE_SECRET_KEY` (ou a service role legada) somente no servidor.
- Restringir acesso administrativo e ativar MFA nos provedores.

## 2. Homologação do banco

- Criar backup restaurável e validar a restauração.
- Executar `supabase/diagnostics/tenant_readiness.sql` e corrigir todo item `CORRIGIR`.
- Aplicar, em ordem, `202608110001`, `202608110002`, `202608110003`, `202608110004`, `202608120001`, `202608200001`, `202608210001` e `202608210002`.
- Rodar `supabase/diagnostics/auditable_dimensioning_readiness.sql`.
- Testar usuário comum, administrador e dois tenants; uma empresa não pode consultar nem relacionar UUIDs da outra.
- Salvar uma memória por fatura e uma campanha temporal; confirmar origem, nível de liberação, transformador, validações e rejeição de duplicata pelo hash.
- Confirmar limites dos quatro planos e configuração individual por tenant.

## 3. Qualidade da aplicação

- Em instalação limpa: `npm ci`, `npm test`, `npm run lint` e `npm run build`.
- Corrigir qualquer erro; não usar flags para ignorar TypeScript ou ESLint.
- Fazer smoke test de cadastro, confirmação de e-mail, recuperação de senha, login/logout, CRUD, upload de PDF, dimensionamento e exportação.
- Confirmar que faturas nunca exibem “especificação liberada”, que campanhas de 24 h ficam preliminares e que somente uma campanha representativa com todas as validações libera a especificação condicionada.
- Testar série com Q capacitivo e confirmar o bloqueio de acréscimo de kVAr.
- Confirmar `/api/health` com HTTP 200 sem expor segredos.

## 4. Mercado Pago

- Confirmar que cada assinatura é criada com `https://www.capacitormanager.com.br/api/mp/webhook` em `notification_url`; para Assinaturas, o Mercado Pago exige a configuração durante a criação.
- Habilitar e testar os tópicos `payment`, `subscription_preapproval` e `subscription_authorized_payment` no ambiente correspondente.
- Cadastrar `MP_WEBHOOK_SECRET` e os quatro IDs `MP_PLAN_*` do mesmo ambiente.
- Testar em sandbox: aprovado, pendente, recusado, cancelado, assinatura inexistente e evento repetido.
- Confirmar que plano/tenant vêm do servidor, que `data.id` assinado corresponde ao corpo e que evento sem assinatura recebe 401.
- Liberar produção apenas após conciliar um ciclo completo de cobrança e cancelamento.

## 5. Operação e venda

- Revisar Termos, Política de Privacidade, política de cancelamento e textos comerciais com assessoria jurídica.
- Definir responsável por incidentes, suporte, backup, restauração e atualização de dependências.
- Configurar monitoramento de erros, disponibilidade, falhas de webhook e crescimento de `api_usage_events`.
- Validar domínio, HTTPS, e-mails transacionais e remetente Resend.
- Manter a origem atrás de proxy confiável (Cloudflare/Vercel ou equivalente) e confirmar que cabeçalhos de IP encaminhado são sobrescritos pelo provedor.
- Publicar claramente limites e escopo; não prometer economia, conformidade normativa ou resultado técnico garantido.

## Aprovação

Registrar versão implantada, data, responsável, evidências dos testes e decisão formal de go/no-go.
