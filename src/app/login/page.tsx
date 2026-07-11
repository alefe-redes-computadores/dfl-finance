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
      {/* Luzes de Fundo */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-teal-500/10 blur-[100px] rounded-full pointer-events-none" />
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
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Gestão inteligente</p>
        </div>

        <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/20 dark:border-zinc-800/50">
          <div className="space-y-4">
            {/* E-mail */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail size={18} className="text-gray-400" />
              </div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-2xl pl-10 pr-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="Seu e-mail"
              />
            </div>

            {/* Senha */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-2xl pl-10 pr-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-teal-600"
                placeholder="Sua senha"
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs text-center font-medium">
                {error}
              </div>
            )}

            <button
              onClick={handleEmail}
              disabled={loading}
              className="w-full bg-teal-600 text-white rounded-2xl py-3.5 font-semibold text-sm flex items-center justify-center gap-2"
            >
              Entrar na conta <ArrowRight size={16} />
            </button>

            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
              <span className="text-xs text-gray-400 uppercase">ou</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
            </div>

            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-white rounded-2xl py-3.5 font-semibold text-sm flex items-center justify-center"
            >
              {loading ? 'Conectando...' : 'Google'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
