import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bwggczkzsqcdeayyysmx.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'COLE_AQUI_A_SUA_CHAVE_ANON_PUBLIC'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
