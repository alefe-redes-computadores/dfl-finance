import { createClient } from '@supabase/supabase-js'

// Forçamos a URL e a chave manualmente se a Vercel falhar na leitura
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bwggczkzsqcdeayyysmx.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3Z2djemt6c3FjZGVheXl5c214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNjg3NTUsImV4cCI6MjA5Njg0NDc1NX0.cNX62xYIZiDbmbPMWNwC03SlwxsVAGlA4_Ww1jvXzfI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)