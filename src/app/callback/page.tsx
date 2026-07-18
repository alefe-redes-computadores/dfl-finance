
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Server, Settings, Cpu, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const frasesEngracadas = [
  "Acordando nossos engenheiros de software...",
  "Girando as manivelas dos servidores na nuvem...",
  "Alimentando os hamsters que giram a roda do banco de dados...",
  "Calculando a rota de fuga caso algo dê errado...",
  "Quase lá! Passando um café para o sistema..."
]

export default function AuthCallback() {
  const router = useRouter()
  const [mensagemIndex, setMensagemIndex] = useState(0)

  // Efeito para trocar a frase a cada 1.5 segundos
  useEffect(() => {
    const intervalo = setInterval(() => {
      setMensagemIndex((atual) => (atual + 1) % frasesEngracadas.length)
    }, 1500)
    return () => clearInterval(intervalo)
  }, [])

  useEffect(() => {
    let isRedirecting = false;

    const redirecionar = () => {
      // Evita que o timeout seja disparado duas vezes
      if (isRedirecting) return;
      isRedirecting = true;
      
      setTimeout(() => {
        router.replace('/home')
      }, 1200)
    }

    const handleAuth = async () => {
      // Checa se já existe sessão no momento em que a página carrega
      const { data } = await supabase.auth.getSession()
      
      if (data?.session) {
        redirecionar()
      }
    }

    handleAuth()

    // Escuta ativamente a mudança de estado (para quando o login via URL processar)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || session) {
        redirecionar()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center overflow-hidden transition-colors duration-300">
      
      {/* Container da Animação Principal */}
      <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
        {/* Círculos pulsantes de fundo */}
        <div className="absolute inset-0 bg-teal-500/20 rounded-full animate-ping opacity-75" />
        <div className="absolute inset-2 bg-blue-500/30 rounded-full animate-pulse" />
        
        {/* Ícone do Servidor com Engrenagem girando */}
        <div className="relative z-10 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700">
          <div className="relative">
            <Server size={40} className="text-teal-600 dark:text-teal-500" />
            <Settings 
              size={20} 
              className="text-gray-400 absolute -bottom-2 -right-2 animate-spin" 
            />
          </div>
        </div>
        
        {/* Partículas flutuantes (Ícones) */}
        <Cpu size={16} className="text-teal-400 absolute top-0 left-0 animate-bounce" />
        <Zap size={16} className="text-yellow-500 absolute bottom-0 right-0 animate-bounce delay-150" />
      </div>

      {/* Textos */}
      <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight mb-2">
        Conectando...
      </h1>
      
      <div className="h-12 flex items-center justify-center w-full max-w-xs">
        <p 
          key={mensagemIndex} 
          className="text-sm font-medium text-gray-500 dark:text-gray-400 animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          {frasesEngracadas[mensagemIndex]}
        </p>
      </div>
      
    </div>
  )
}
