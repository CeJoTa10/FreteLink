import { createClient } from '@supabase/supabase-js';

// Tenta pegar da Vercel/Ambiente, se não achar, usa a sua URL real fixa
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ynhcesyfdfjhvmowakhy.supabase.co';

// Tenta pegar da Vercel/Ambiente, se não achar, usa a sua chave real fixa
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Zof2LMCZ-MjTUPI4lny3KQ_K1taq5DW';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);