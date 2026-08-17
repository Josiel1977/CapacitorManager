'use client';

import { useState } from 'react';

export default function AuditoriaFaturaPage() {
  const [file, setFile] = useState<File | null>(null);
  const [potenciaKva, setPotenciaKva] = useState('');
  const [parqueKvar, setParqueKvar] = useState('');
  const [loading, setLoading] = useState(false);
  const [laudoHtml, setLaudoHtml] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert('Por favor, selecione o arquivo da fatura.');
      return;
    }

    setLoading(true);
    setLaudoHtml(null);

    const formData = new FormData();
    formData.append('fatura', file);
    formData.append('potencia_subestacao_kva', potenciaKva);
    formData.append('parque_instalado_kvar', parqueKvar);

    try {
      const response = await fetch('/api/capacitormanager/auditar-fatura', {
        method: 'POST',
        body: formData,
      });

      const resultado = await response.json();
      if (resultado.status === 'sucesso') {
        setLaudoHtml(resultado.laudo_html);
      } else {
        alert('Erro: ' + resultado.error);
      }
    } catch (err) {
      console.error(err);
      alert('Erro de comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold">MaintainFlow™ | Módulo de Auditoria e Teste de Faturas</h1>
        <p className="text-slate-400 mt-1">Envie a fatura da concessionária e informe os dados de campo para gerar o laudo instantâneo.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md space-y-4 border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Potência Total da Subestação (kVA)</label>
            <input
              type="text"
              value={potenciaKva}
              onChange={(e) => setPotenciaKva(e.target.value)}
              placeholder="Ex: 1050"
              className="mt-1 block w-full rounded-md border border-slate-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Parque de Capacitores Instalado (kVAr)</label>
            <input
              type="text"
              value={parqueKvar}
              onChange={(e) => setParqueKvar(e.target.value)}
              placeholder="Ex: 265"
              className="mt-1 block w-full rounded-md border border-slate-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Arquivo da Fatura (PDF ou Imagem)</label>
          <input
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? 'Processando Fatura e Calculando Engenharia...' : 'Gerar Laudo Técnico e Diagnóstico'}
        </button>
      </form>

      {laudoHtml && (
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 space-y-4">
          <h2 className="text-xl font-bold text-slate-800 border-b pb-2">Laudo Técnico Conclusivo</h2>
          <div className="prose max-w-none text-slate-700 whitespace-pre-wrap font-sans text-sm bg-slate-50 p-6 rounded-lg border">
            {laudoHtml}
          </div>
        </div>
      )}
    </div>
  );
}