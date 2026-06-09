import { createClient } from '@supabase/supabase-js';

// Tenta pegar da Vercel/Ambiente, se não achar, usa a sua URL real fixa
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ynhcesyfdfjhvmowakhy.supabase.co';

// Sanitização robusta para evitar que caminhos como /rest/v1 quebrem o SDK
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

// Tenta pegar da Vercel/Ambiente, se não achar, usa a sua chave real fixa
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaGNlc3lmZGZqaHZtb3dha2h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMTAwMDUsImV4cCI6MjA5NTY4NjAwNX0.YkaWyhlTS6hOFUiaynKMaqBBTxgZt1NoO1yMPRo7LU4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);