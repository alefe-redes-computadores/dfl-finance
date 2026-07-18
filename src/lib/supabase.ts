import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Força o padrão mais seguro que devolve ?code=
    flowType: 'pkce',
    // Garante que o Next.js e o Supabase leiam a URL de retorno automaticamente
    detectSessionInUrl: true, 
  }
})
