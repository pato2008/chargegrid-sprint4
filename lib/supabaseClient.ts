import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar definidas (.env na raiz do projeto). Veja .env.example.',
  );
}

// A "anon key" (ou "publishable key", no formato novo sb_publishable_...) é
// feita para ser exposta no bundle do navegador — a segurança vem das
// políticas de Row Level Security definidas em supabase/migrations, não do
// sigilo dessa chave. Nunca use a service_role key aqui.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
