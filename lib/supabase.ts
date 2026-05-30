// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validação mais robusta
if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
  console.warn('⚠️ Supabase URL não configurada. Verifique o arquivo .env.local');
}

if (!supabaseAnonKey || supabaseAnonKey === 'placeholder') {
  console.warn('⚠️ Supabase Anon Key não configurada. Verifique o arquivo .env.local');
}

// Criar cliente com opções adicionais
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

// Função para verificar conexão
export async function checkSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('clientes').select('id').limit(1);
    if (error) throw error;
    console.log('✅ Supabase conectado com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com Supabase:', error);
    return false;
  }
}
