'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Server, Settings, Cpu, Zap, AlertCircle } from 'lucide-react'

const frasesEngracadas = [
  "Acordando nossos engenheiros de software...",
  "Girando as manivelas dos servidores na nuvem...",
  "Alimentando os hamsters que giram a roda do banco de dados...",
  "Calculando a rota de fuga caso algo dê errado...",
  "Quase lá! Passando um café para o sistema..."
]

// 1. O componente que faz o trabalho duro (lê URL, conecta no Supabase e tem a UI)
function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [mensagemIndex, setMensagemIndex] = useState(0)

  useEffect(() => {
    const intervalo = setInterval(() => {
      setMensagemIndex((atual) => (atual + 1) % frasesEngracadas.length)
    }, 1500)
    return () => clearInterval(intervalo)
  }, [])

  useEffect(() => {
    let isRedirecting = false
    const redirecionar = () => {
      if (isRedirecting) return
      isRedirecting = true
      setTimeout(() => router.replace('/home'), 1200)
    }

    const handleAuth = async () => {
      const { data: existing } = await supabase.auth.getSession()
      if (existing?.session) {
        redirecionar()
        return
      }

      const code = searchParams.get('code')
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setErrorMsg(error.message)
          return
        }
        if (data?.session) {
          redirecionar()
          return
        }
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) redirecionar()
      })
      return () => subscription.unsubscribe()
    }

    handleAuth()
  }, [router, searchParams])

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Falha ao conectar</h1>
        <p className="text-red-500 mt-2">{errorMsg}</p>
        <button onClick={() => router.replace('/login')} className="mt-6 px-6 py-2 bg-teal-600 text-white rounded-full">Tentar novamente</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center transition-colors duration-300">
      <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
        <div className="absolute inset-0 bg-teal-500/20 rounded-full animate-ping opacity-75" />
        <div className="relative z-10 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700">
          <Server size={40} className="text-teal-600 dark:text-teal-500" />
          <Settings size={20} className="text-gray-400 absolute -bottom-2 -right-2 animate-spin" />
        </div>
      </div>
      <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Conectando...</h1>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 animate-in fade-in duration-500">
        {frasesEngracadas[mensagemIndex]}
      </p>
    </div>
  )
}

// 2. O componente principal que envelopa a lógica com o Suspense (Isso resolve o erro da Vercel)
export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col items-center justify-center">
         <h1 className="text-xl font-bold text-gray-900 dark:text-white">Preparando sistema...</h1>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  )
}
