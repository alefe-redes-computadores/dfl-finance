'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { useAuthDeepLink } from '@/lib/hooks/useAuthDeepLink'

export default function LoginPage() {
  const router = useRouter()
  const { isProcessing } = useAuthDeepLink() // Ativando o ouvido do aplicativo aqui!
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleEmail() {
    setLoading(true)
    setError('')
    
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      
      if (signInErr) {
        const { error: signUpErr } = await supabase.auth.signUp({ email, password })
        if (signUpErr) {
          setError('E-mail ou senha inválidos.')
          setLoading(false) 
        } else {
          router.replace('/home')
        }
      } else {
        router.replace('/home')
      }
    } catch (err) {
      setError('Ocorreu um erro inesperado.')
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setLoading(true)
    setError('')
    
    try {
      const isNative = Capacitor.isNativePlatform()
      
      const redirectUrl = isNative 
        ? 'dfl://callback' 
        : `${window.location.origin}`

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { 
          redirectTo: redirectUrl,
          skipBrowserRedirect: isNative, 
        }
      })

      if (error) {
        throw error
      }

      if (isNative && data?.url) {
        await Browser.open({ url: data.url, presentationStyle: 'popover' })
        setLoading(false)
      }
      
    } catch (err) {
      setError('Erro ao entrar com Google.')
      setLoading(false) 
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300">
      
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-teal-500/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 drop-shadow-xl">
              <rect width="40" height="40" rx="12" className="fill-teal-600 dark:fill-teal-500" />
              <path d="M12 28V12H20C23.3137 12 26 14.6863 26 18C26 21.3137 23.3137 24 20 24H16V28H12Z" fill="white"/>
              <path d="M28 28V12H24V28H28Z" fill="white" fillOpacity="0.7"/>
              <defs>
                <linearGradient id="paint0_linear" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#14b8a6" />
                  <stop offset="1" stopColor="#0f766e" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="text-[26px] font-black text-gray-900 dark:text-white tracking-tight">DFL Finance</h1>
          <p className="text-gray-500 dark:text-gray-400 text-[13px] font-medium mt-1 uppercase tracking-widest">Gestão Inteligente</p>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-[32px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-white/40 dark:border-slate-700/50">
          <div className="space-y-4">
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail size={18} className="text-gray-400" />
              </div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600/50 rounded-[20px] pl-11 pr-4 py-4 text-[15px] font-semibold outline-none focus:ring-2 focus:ring-teal-500/50 text-gray-800 dark:text-white transition-all placeholder:text-gray-400"
                placeholder="Seu melhor e-mail"
              />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEmail()}
                className="w-full bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600/50 rounded-[20px] pl-11 pr-4 py-4 text-[15px] font-semibold outline-none focus:ring-2 focus:ring-teal-500/50 text-gray-800 dark:text-white transition-all placeholder:text-gray-400"
                placeholder="Sua senha"
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-[16px] text-[13px] text-center font-bold border border-red-100 dark:border-red-500/20">
                {error}
              </div>
            )}

            <button
              onClick={handleEmail}
              disabled={loading || !email || !password || isProcessing}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-[24px] py-4 font-bold text-[16px] flex items-center justify-center gap-2 shadow-lg shadow-teal-600/30 transition-transform active:scale-[0.98] disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 mt-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  Entrar na conta
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <div className="flex items-center gap-3 py-3">
              <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">ou acesse com</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
            </div>

            <button
              onClick={handleGoogle}
              disabled={loading || isProcessing}
              className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-800 dark:text-white rounded-[24px] py-4 font-bold text-[15px] flex items-center justify-center gap-3 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              {loading || isProcessing ? (
                <Loader2 className="animate-spin text-gray-400" size={20} />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {loading || isProcessing ? 'Conectando...' : 'Google'}
            </button>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">Uso Interno e Pessoal</p>
        </div>
      </div>
    </div>
  )
}
