import { createClient } from '@/lib/supabase/server';

export default async function VisualizarLaudo({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const supabase = await createClient();

  const { data: auditoria } = await supabase
    .from('auditorias')
    .select('laudo_html, criado_em')
    .eq('id', resolvedParams.id)
    .single();

  if (!auditoria) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
        <h1 className="text-xl font-bold">Laudo técnico não encontrado ou expirado.</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-slate-200 space-y-6">
        <div className="border-b pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">MaintainFlow™ | Laudo de Auditoria Energética</h1>
            <p className="text-xs text-slate-500">Emitido por JM Eletro Service • Referência: {new Date(auditoria.criado_em).toLocaleDateString()}</p>
          </div>
          <button 
            onClick={() => typeof window !== 'undefined' && window.print()} 
            className="bg-primary text-white text-xs px-4 py-2 rounded-lg font-medium hover:opacity-90"
          >
            Imprimir / Salvar PDF
          </button>
        </div>
        <div 
          className="prose max-w-none text-slate-700 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: auditoria.laudo_html }}
        />
      </div>
    </div>
  );
}
