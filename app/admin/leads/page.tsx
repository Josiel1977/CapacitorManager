'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    setLeads(data || []);
    setLoading(false);
  }

  async function marcarComoLida(id: string, lida: boolean) {
    await supabase.from('leads').update({ lida: !lida }).eq('id', id);
    fetchLeads();
  }

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Solicitações de Contato</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr>
              <th className="px-4 py-2 border">Data</th>
              <th className="px-4 py-2 border">Nome</th>
              <th className="px-4 py-2 border">Email</th>
              <th className="px-4 py-2 border">Telefone</th>
              <th className="px-4 py-2 border">Empresa</th>
              <th className="px-4 py-2 border">Plano</th>
              <th className="px-4 py-2 border">Lida</th>
              <th className="px-4 py-2 border">Ações</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead: any) => (
              <tr key={lead.id}>
                <td className="px-4 py-2 border">{new Date(lead.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-2 border">{lead.nome}</td>
                <td className="px-4 py-2 border">{lead.email}</td>
                <td className="px-4 py-2 border">{lead.telefone || '-'}</td>
                <td className="px-4 py-2 border">{lead.empresa || '-'}</td>
                <td className="px-4 py-2 border">{lead.plano_interesse || '-'}</td>
                <td className="px-4 py-2 border">{lead.lida ? 'Sim' : 'Não'}</td>
                <td className="px-4 py-2 border">
                  <button
                    onClick={() => marcarComoLida(lead.id, lead.lida)}
                    className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                  >
                    {lead.lida ? 'Marcar como não lida' : 'Marcar como lida'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
