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
        // 👇 A MUDANÇA ESTÁ AQUI: Redirecionando para a ponte!
        redirectTo: `${window.location.origin}/auth/callback` 
      }
    })
    if (error) {
      setError('Erro ao entrar com Google.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Luzes de Fundo (Efeito moderno) */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-teal-500/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          {/* Novo Logotipo DFL em SVG */}
          <div className="flex justify-center mb-4">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 drop-shadow-xl">
              <rect width="40" height="40" rx="12" className="fill-teal-600 dark:fill-teal-600" />
              <path d="M12 28V12H20C23.3137 12 26 14.6863 26 18C26 21.3137 23.3137 24 20 24H16V28H12Z" fill="white"/>
              <path d="M28 28V12H24V28H28Z" fill="white" fillOpacity="0.7"/>
              <defs>
                <linearGradient id="paint0_linear" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#0d9488" />
                  <stop offset="1" stopColor="#0f766e" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">DFL Finance</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Gestão inteligente do seu dinheiro</p>
        </div>

        {/* Card Principal */}
        <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/20 dark:border-zinc-800/50">
          <div className="space-y-4">
            
            {/* Input de E-mail */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail size={18} className="text-gray-400" />
              </div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-2xl pl-10 pr-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-teal-600 text-gray-800 dark:text-white transition-all shadow-sm"
                placeholder="Seu melhor e-mail"
              />
            </div>

            {/* Input de Senha */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEmail()}
                className="w-full bg-white dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-2xl pl-10 pr-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-teal-600 text-gray-800 dark:text-white transition-all shadow-sm"
                placeholder="Sua senha"
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs text-center font-medium">
                {error}
              </div>
            )}

            {/* Botão de Entrar (E-mail) */}
            <button
              onClick={handleEmail}
              disabled={loading || !email || !password}
              className="w-full bg-teal-600 hover:opacity-90 text-white rounded-2xl py-3.5 font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/30 transition-all disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? 'Processando...' : (
                <>
                  Entrar na conta
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Divisor */}
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">ou acesse com</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
            </div>

            {/* Botão do Google */}
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-white rounded-2xl py-3.5 font-semibold text-sm flex items-center justify-center gap-3 shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {loading ? 'Conectando...' : 'Google'}
            </button>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400 font-medium">Uso Interno e Pessoal</p>
        </div>
      </div>
    </div>
  )
}
