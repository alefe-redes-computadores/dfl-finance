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

  async function handleEmail() {
    setLoading(true)
    setError('')
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
    if (signInErr) {
      const { error: signUpErr } = await supabase.auth.signUp({ email, password })
      if (signUpErr) {
        setError('E-mail ou senha inválidos.')
      } else {
        router.replace('/home')
      }
    } else {
      router.replace('/home')
    }
    setLoading(false)
  }

  async function handleGoogle() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        // Aqui está a mudança: usamos o nosso protocolo personalizado
        redirectTo: 'dfl://callback' 
      }
    })
    if (error) {
      setError('Erro ao entrar com Google.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-teal-500/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 drop-shadow-xl">
              <rect width="40" height="40" rx="12" className="fill-teal-600 dark:fill-teal-600" />
              <path d="M12 28V12H20C23.3137 12 26 14.6863 26 18C26 21.3137 23.3137 24 20 24H16V28H12Z" fill="white"/>
              <path d="M28 28V12H24V28H28Z" fill="white" fillOpacity="0.7"/>
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">DFL Finance</h1>
        </div>

        <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/20 dark:border-zinc-800/50">
          <div className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 text-sm outline-none"
              placeholder="Seu melhor e-mail"
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 text-sm outline-none"
              placeholder="Sua senha"
            />
            <button
              onClick={handleEmail}
              disabled={loading}
              className="w-full bg-teal-600 text-white rounded-2xl py-3.5 font-semibold text-sm"
            >
              Entrar na conta
            </button>
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-white rounded-2xl py-3.5 font-semibold text-sm"
            >
              {loading ? 'Conectando...' : 'Google'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
