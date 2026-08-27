import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  FileText,
  Gauge,
  Leaf,
  LockKeyhole,
  ShieldCheck,
  Wrench,
  Zap,
} from 'lucide-react';

const outcomes = [
  {
    icon: FileSearch,
    title: 'Audite a fatura',
    description: 'Identifique cobranças por energia reativa e organize as evidências sem redigitar dezenas de campos.',
  },
  {
    icon: Gauge,
    title: 'Valide o banco',
    description: 'Compare corrente ou capacitância medidas com o comportamento esperado de cada capacitor.',
  },
  {
    icon: FileText,
    title: 'Entregue uma decisão',
    description: 'Transforme faturas, medições e histórico em um relatório rastreável para cliente e manutenção.',
  },
];

const audiences = [
  { icon: Wrench, label: 'Empresas de manutenção elétrica' },
  { icon: BarChart3, label: 'Consultorias e gestores de energia' },
  { icon: Leaf, label: 'Agroindústrias e unidades produtivas' },
  { icon: Building2, label: 'Indústrias com vários bancos' },
];

export default function PublicLanding() {
  return (
    <div className="overflow-hidden bg-white text-slate-900">
      <section className="relative isolate bg-primary text-white">
        <div className="absolute inset-0 -z-10 opacity-30 [background-image:radial-gradient(circle_at_80%_20%,#f39c12_0,transparent_24%),radial-gradient(circle_at_20%_80%,#1a4b6c_0,transparent_32%)]" />
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-8">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/90">
              <BadgeCheck size={17} className="text-secondary" aria-hidden="true" />
              Diagnóstico técnico sem instalar software
            </div>
            <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Descubra se seus bancos estão <span className="text-secondary">economizando</span> ou gerando multas.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75 sm:text-xl">
              Envie uma fatura ou uma medição e transforme dados elétricos em diagnóstico, prioridade de manutenção e relatório para decisão.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/demo" className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-4 font-black text-primary shadow-lg shadow-black/15 transition-transform hover:-translate-y-0.5">
                <FileSearch size={20} aria-hidden="true" /> Analisar uma fatura grátis <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/relatorio-exemplo" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-4 font-bold text-white hover:bg-white/15">
                <FileText size={20} aria-hidden="true" /> Ver relatório de exemplo
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/65">
              <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-secondary" /> Sem cadastro para testar</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-secondary" /> Resultado em poucos minutos</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-secondary" /> Seus dados não entram na demonstração pública</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur sm:p-7">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">Exemplo de saída</p>
                <h2 className="mt-1 text-xl font-bold">Diagnóstico executivo</h2>
              </div>
              <ShieldCheck className="text-secondary" size={30} aria-hidden="true" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 text-slate-900">
                <p className="text-xs font-semibold uppercase text-slate-500">Cobrança reativa</p>
                <p className="mt-1 text-2xl font-black text-red-600">Identificada</p>
                <p className="mt-1 text-xs text-slate-500">Valor documental separado da projeção.</p>
              </div>
              <div className="rounded-2xl bg-white p-4 text-slate-900">
                <p className="text-xs font-semibold uppercase text-slate-500">Confiabilidade</p>
                <p className="mt-1 text-2xl font-black text-amber-600">Preliminar</p>
                <p className="mt-1 text-xs text-slate-500">O sistema informa o que ainda precisa ser medido.</p>
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-secondary/30 bg-secondary/10 p-4">
              <p className="text-sm font-bold text-secondary">Próxima ação recomendada</p>
              <p className="mt-1 text-sm leading-6 text-white/80">Confirmar demanda e fator de potência coincidentes, inspecionar estágios e registrar medições do banco antes da especificação definitiva.</p>
            </div>
            <p className="mt-4 text-xs leading-5 text-white/50">Exemplo ilustrativo. O CapacitorManager separa extração documental, estimativa e conclusão técnica para não prometer o que os dados ainda não sustentam.</p>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-7 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {audiences.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
              <Icon size={19} className="text-secondary" aria-hidden="true" /> {label}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-secondary">Do dado à decisão</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-primary sm:text-4xl">Uma ferramenta para agir, não apenas para montar gráficos.</h2>
          <p className="mt-4 text-lg text-slate-600">O primeiro resultado útil aparece antes do cadastro. A gestão completa entra quando você decide acompanhar clientes, bancos e histórico.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {outcomes.map(({ icon: Icon, title, description }, index) => (
            <article key={title} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-secondary"><Icon size={24} /></span>
                <span className="text-4xl font-black text-slate-100">0{index + 1}</span>
              </div>
              <h3 className="mt-6 text-xl font-black text-primary">{title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-2 lg:items-center lg:px-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-secondary">Piloto assistido</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Comece com uma unidade, um cliente e um problema real.</h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">A JM Eletro Service ajuda a organizar a primeira fatura, cadastrar o primeiro banco e interpretar o resultado. Você avalia o valor antes de decidir pelo plano.</p>
            <div className="mt-6 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              <span className="flex items-center gap-2"><ClipboardCheck size={17} className="text-secondary" /> Configuração inicial orientada</span>
              <span className="flex items-center gap-2"><LockKeyhole size={17} className="text-secondary" /> Ambiente isolado por empresa</span>
              <span className="flex items-center gap-2"><Zap size={17} className="text-secondary" /> Diagnóstico com seus dados</span>
              <span className="flex items-center gap-2"><FileText size={17} className="text-secondary" /> Relatório para decisão</span>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9">
            <p className="text-sm font-bold text-secondary">Sem compromisso comercial na primeira conversa</p>
            <h3 className="mt-2 text-2xl font-black">Mostre sua necessidade. Nós montamos o primeiro caminho.</h3>
            <p className="mt-4 leading-7 text-slate-300">Ideal para gestores de energia, manutenção industrial, consultorias e operações do agronegócio.</p>
            <Link href="/contato" className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-4 font-black text-primary transition-transform hover:-translate-y-0.5">
              Solicitar piloto assistido <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
