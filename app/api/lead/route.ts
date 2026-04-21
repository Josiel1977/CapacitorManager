import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializa o cliente do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nome, email, telefone, empresa, plano_interesse, mensagem, origem } = body;

    // Validação básica
    if (!nome || !email) {
      return NextResponse.json(
        { error: 'Nome e e-mail são obrigatórios.' },
        { status: 400 }
      );
    }

    // Insere no Supabase
    const { data, error } = await supabase
      .from('leads')
      .insert([
        {
          nome,
          email,
          telefone: telefone || null,
          empresa: empresa || null,
          plano_interesse: plano_interesse || null,
          mensagem: mensagem || null,
          origem: origem || 'Site',
          lida: false,
        }
      ])
      .select();

    if (error) {
      console.error('Erro ao inserir lead:', error);
      return NextResponse.json(
        { error: 'Erro ao registrar sua solicitação.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Solicitação recebida com sucesso!', lead: data?.[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro inesperado:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}```tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      setLeads(data || []);
      setLoading(false);
    };

    fetchLeads();
  }, []);

  if (loading) return <div>Carregando...</div>;

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
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td className="px-4 py-2 border">{new Date(lead.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-2 border">{lead.nome}</td>
                <td className="px-4 py-2 border">{lead.email}</td>
                <td className="px-4 py-2 border">{lead.telefone || '-'}</td>
                <td className="px-4 py-2 border">{lead.empresa || '-'}</td>
                <td className="px-4 py-2 border">{lead.plano_interesse}</td>
                <td className="px-4 py-2 border">{lead.lida ? 'Sim' : 'Não'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```
