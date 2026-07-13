'use client'

import { useState, useEffect } from 'react'
import { Terminal, Trash2 } from 'lucide-react'

// Este componente é o "Console Display" do seu painel
export function AdminLogger() {
  const [logs, setLogs] = useState<{id: number, text: string, type: string}[]>([])

  // Função para adicionar um log (para ser usada pelo seu sistema)
  // Exportamos isso ou usamos um padrão de EventListener global
  useEffect(() => {
    const handleLog = (e: any) => {
      setLogs(prev => [...prev, { id: Date.now(), text: e.detail.msg, type: e.detail.type }].slice(-50))
    }
    window.addEventListener('admin-log', handleLog)
    return () => window.removeEventListener('admin-log', handleLog)
  }, [])

  const clearLogs = () => setLogs([])

  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-700 shadow-xl overflow-hidden flex flex-col h-[300px]">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-700">
        <div className="flex items-center gap-2 text-slate-400">
          <Terminal size={16} />
          <span className="text-xs font-mono">DEBUG_CONSOLE</span>
        </div>
        <button onClick={clearLogs} className="text-slate-500 hover:text-red-400 transition-colors">
          <Trash2 size={16} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[11px]">
        {logs.length === 0 ? (
          <p className="text-slate-600 italic">Aguardando logs do sistema...</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className={`${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : 'text-slate-300'}`}>
              <span className="opacity-50">[{new Date(log.id).toLocaleTimeString()}]</span> {log.text}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
