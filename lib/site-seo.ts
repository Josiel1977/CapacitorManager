import type {Metadata} from 'next';

// The bare domain redirects to this verified production host.
export const SITE_URL='https://www.capacitormanager.com.br';
export const SITE_TITLE='CapacitorManager | Auditoria Energética e Bancos de Capacitores';
export const SITE_DESCRIPTION='Audite faturas de energia, analise cobranças reativas, compare demandas e modalidades tarifárias e apoie o dimensionamento de bancos de capacitores.';
export const PUBLIC_SEO_PAGES=[
 {path:'/',title:SITE_TITLE,description:SITE_DESCRIPTION},
 {path:'/auditoria',title:'Auditoria de Fatura e Gestão Tarifária | CapacitorManager',description:'Analise faturas da Equatorial Pará, identifique cobranças reativas e financeiras e prepare estudos de demanda e modalidades com dados verificáveis.'},
 {path:'/como-usar',title:'Como Usar a Plataforma | CapacitorManager',description:'Conheça o fluxo de auditoria de faturas, análise de medições e elaboração de relatórios técnicos no CapacitorManager.'},
 {path:'/planos',title:'Planos e Recursos | CapacitorManager',description:'Conheça os planos e recursos para auditoria energética, gestão de bancos de capacitores e relatórios técnicos no CapacitorManager.'},
 {path:'/contato',title:'Contato | CapacitorManager',description:'Fale com a equipe do CapacitorManager sobre auditoria energética, bancos de capacitores e uso da plataforma.'},
 {path:'/relatorio-exemplo',title:'Exemplo de Relatório Energético | CapacitorManager',description:'Veja um exemplo demonstrativo de relatório técnico para apoiar decisões de manutenção e gestão de bancos de capacitores.'},
 {path:'/demo',title:'Demonstração de Auditoria Energética | CapacitorManager',description:'Experimente o fluxo de análise de faturas e conheça os recursos de auditoria energética do CapacitorManager.'},
 {path:'/ajuda',title:'Ajuda e Suporte | CapacitorManager',description:'Encontre orientações para usar os recursos de auditoria de energia, medições e relatórios do CapacitorManager.'},
] as const;
export function indexableEnvironment(environment=process.env.VERCEL_ENV):boolean {
 return !environment||environment==='production';
}
export function publicPageMetadata(path:string):Metadata {
 const page=PUBLIC_SEO_PAGES.find(p=>p.path===path);
 if(!page)throw new Error(`Página pública sem configuração SEO: ${path}`);
 const url=new URL(path,SITE_URL).href;
 const image={url:`${SITE_URL}/opengraph-image`,width:1200,height:630,alt:'CapacitorManager — Auditoria energética e bancos de capacitores. JM Eletro Service.'};
 return {
  title:{absolute:page.title},description:page.description,
  alternates:{canonical:url},
  robots:{index:indexableEnvironment(),follow:true},
  openGraph:{type:'website',locale:'pt_BR',siteName:'CapacitorManager',url,title:page.title,description:page.description,images:[image]},
  twitter:{card:'summary_large_image',title:page.title,description:page.description,images:[image]},
 };
}
