import { createClient } from './supabase/client';

export const supabase = createClient();

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
