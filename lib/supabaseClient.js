// Compatibilidade para telas legadas. Todas as consultas do navegador devem
// compartilhar a mesma instância/cookie usada pelo AuthContext, principalmente
// depois da ativação do RLS por tenant.
import { createClient } from './supabase/client';

export const supabase = createClient();
