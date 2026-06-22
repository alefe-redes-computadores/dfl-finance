import { createClient } from '@supabase/supabase-js'

// APENAS PARA TESTE: Insira a URL e KEY aqui temporariamente
const supabaseUrl = "SUA_URL_DO_SUPABASE_AQUI"
const supabaseAnonKey = "SUA_KEY_ANON_AQUI"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
