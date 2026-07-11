'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Mail, Lock, ArrowRight } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleGoogle() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        // Vamos usar a URL de callback padrão do seu Supabase
        redirectTo: 'https://bwggczkzsqcdeayyysmx.supabase.co/auth/v1/callback' 
      }
    })
    if (error) {
      setError('Erro ao conectar.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
           {/* Logo Restaurado */}
           <div className="flex justify-center mb-4">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 drop-shadow-xl">
              <rect width="40" height="40" rx="12" className="fill-teal-600" />
              <path d="M12 28V12H20C23.3137 12 26 14.6863 26 18C26 21.3137 23.3137 24 20 24H16V28H12Z" fill="white"/>
              <path d="M28 28V12H24V28H28Z" fill="white" fillOpacity="0.7"/>
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">DFL Finance</h1>
        </div>

        <div className="bg-white/70 dark:bg-zinc-900/70 p-6 rounded-3xl shadow-xl border border-white/20">
          <div className="space-y-4">
            {/* ... seus inputs de email/senha aqui ... */}
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full bg-white border border-gray-200 text-gray-800 rounded-2xl py-3.5 font-semibold text-sm flex items-center justify-center gap-2"
            >
              {/* O Ícone do Google pode ser adicionado aqui com uma tag <img> ou svg */}
              {loading ? 'Conectando...' : 'Entrar com Google'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
