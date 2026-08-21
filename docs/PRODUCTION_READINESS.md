# Situação de prontidão para produção

## Implementado neste pacote

- Remoção de credencial pública e validação de sessão no servidor.
- Recuperação e redefinição de senha.
- Cadastro centralizado no servidor com validação, limitação de tentativas e limpeza em falha.
- RLS multiempresa, proteção administrativa, limites comerciais e validação de vínculos no banco.
- Checkout autenticado, plano/tenant derivados do servidor e webhook Mercado Pago assinado, idempotente e reprocessável após falha.
- Acesso comercial bloqueado no proxy e no RLS enquanto a assinatura não estiver ativa; administradores mantêm o acesso de suporte.
- Leads validados, consentimento explícito, sanitização, rate limit e notificação sem perder o registro quando o e-mail falha.
- Chat restrito a conta autorizada, prompt do servidor, limite de tamanho e de uso.
- Auditoria baseada no PDF enviado, sem dados fictícios e com projeção anual identificada como estimativa.
- Correção da corrente esperada em função de tensão e frequência.
- Dimensionamento com projeção real quando há limite de transformador e economia prudente de 90%.
- Separação explícita entre fatura (pré-dimensionamento), campanha temporal e especificação condicionada.
- Faixa P50/P90/P95, qualidade temporal, detecção de sobrecompensação e travas de liberação técnica.
- Memória técnica temporal imutável com snapshot das medições, confirmações explícitas, hash de integridade e isolamento por empresa.
- Planos centralizados e pacote sem artefatos de build.

## Bloqueios antes de vender

1. Rotacionar a credencial que esteve exposta e revisar logs/histórico de acesso.
2. Aplicar e validar todas as migrações em homologação e depois em produção.
3. Preencher os segredos, configurar webhook e executar testes completos de cobrança em sandbox.
4. Executar instalação limpa, lint e build no ambiente de CI/homologação.
5. Fazer revisão elétrica do motor e dos relatórios com profissional habilitado.
   A revisão deve incluir uma campanha real de sete dias, harmônicos/ressonância, proteção, cabos, manobra, ventilação e documentação da decisão.
6. Fazer revisão jurídica dos termos, privacidade, cancelamento e publicidade.
7. Implantar monitoramento, rotina de backup/restauração e resposta a incidentes.

O código está mais seguro e auditável, mas “pronto para vender” depende também dessas validações operacionais externas. Use o checklist como critério de liberação.
