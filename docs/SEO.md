# SEO público do CapacitorManager

Domínio canônico confirmado: https://www.capacitormanager.com.br. A versão sem www redireciona para ele. Não definir um canonical genérico da home em páginas internas.

`lib/site-seo.ts` centraliza títulos, descrições e a lista de páginas públicas indexáveis. As demais rotas herdam `noindex, follow`; isso não substitui a autenticação existente. Os layouts públicos são passagens de children, sem mudanças nos cálculos, formulários ou autorização.

A home entrega a apresentação pública no HTML inicial enquanto restaura a sessão, preservando a seleção do painel para usuários autenticados. A imagem compartilhada é produzida pelo Next em `/opengraph-image`, em PNG de 1200×630, sem imagem externa inexistente. Não há dependência nova.

- Sitemap: https://www.capacitormanager.com.br/sitemap.xml
- Robots: https://www.capacitormanager.com.br/robots.txt
- Previews Vercel: `noindex` e robots que desautoriza rastreamento; sitemap sem páginas.
- Produção: sitemap contém apenas as páginas públicas configuradas, sem clientes, laudos, login, recuperação de senha ou telas internas. Páginas não indexáveis podem ser rastreadas para que o robô leia o `noindex`.

Após publicar, o proprietário pode verificar a propriedade no Google Search Console, enviar `sitemap.xml` e inspecionar a home e a auditoria. Nenhuma verificação ou submissão é simulada pelo aplicativo. Metadados não garantem posição nem prazo de indexação. A tag `keywords` é informativa e não influencia o ranking do Google.

Validação: testes de configuração, build, `scripts/test-site-seo.mjs` (HTML real, canonicals individuais, noindex, sitemap, robots e bytes PNG) e fluxo existente de auditoria/impressão.
