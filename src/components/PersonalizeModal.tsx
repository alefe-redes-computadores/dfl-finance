'use client'

import { useEffect, useState } from 'react'
import { MoveUp, MoveDown, X, Save, LayoutGrid } from 'lucide-react'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

interface Section {
  id: string
  label: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  sections: Section[]
  enabled: Set<string>
  order: Section[]
  onToggle: (id: string) => void
  onMove: (id: string, dir: 'up' | 'down') => void
  onSave: () => void
}

export default function PersonalizeModal({ isOpen, onClose, sections, enabled, order, onToggle, onMove, onSave }: Props) {
  const [localOrder, setLocalOrder] = useState<Section[]>(order)
  const [animatingId, setAnimatingId] = useState<string | null>(null)
  const { vibrate } = useHapticFeedback()

  useEffect(() => {
    setLocalOrder(order)
  }, [order])

  const handleMove = (id: string, dir: 'up' | 'down') => {
    vibrate([5])
    const idx = localOrder.findIndex(s => s.id === id)
    if (idx === -1) return
    const newOrder = [...localOrder]
    const target = dir === 'up' ? idx - 1 : idx + 1
    if (target >= 0 && target < newOrder.length) {
      setAnimatingId(id)
      setTimeout(() => setAnimatingId(null), 300)
      
      const temp = newOrder[idx]
      newOrder[idx] = newOrder[target]
      newOrder[target] = temp
      
      setLocalOrder(newOrder)
    }
    onMove(id, dir)
  }

  const handleToggle = (id: string) => {
    vibrate([5])
    onToggle(id)
  }

  const handleSave = () => {
    vibrate([10, 50])
    onSave()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
      <div className="relative w-full max-w-md bg-[#f8f9fa] dark:bg-slate-900 rounded-t-[32px] sm:rounded-[32px] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        
        {/* Header Premium */}
        <div className="flex-shrink-0 bg-white dark:bg-slate-800 px-6 pt-6 pb-4 rounded-t-[32px] sm:rounded-t-[32px] border-b border-gray-50 dark:border-slate-700/50">
          <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6 sm:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[16px] bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center shadow-sm">
                <LayoutGrid size={22} className="text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h2 className="font-bold text-[18px] text-gray-800 dark:text-gray-100 tracking-tight">Personalizar Home</h2>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-0.5">Ative e reordene</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2.5 bg-gray-100 dark:bg-slate-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full transition-colors active:scale-95">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Lista de Seções */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
          {localOrder.map((sec, idx) => {
            const active = enabled.has(sec.id)
            const isAnimating = animatingId === sec.id
            
            return (
              <div
                key={sec.id}
                className={`flex items-center gap-4 p-4 rounded-[24px] transition-all duration-300 border ${
                  active 
                    ? 'bg-white dark:bg-slate-800 shadow-sm border-gray-50 dark:border-slate-700/50' 
                    : 'bg-gray-50 dark:bg-slate-800/40 border-transparent opacity-60'
                } ${isAnimating ? 'scale-[1.02] shadow-md border-teal-200 dark:border-teal-800/50' : 'scale-100'}`}
              >
                {/* Switch iOS Style */}
                <button 
                  onClick={() => handleToggle(sec.id)} 
                  className={`relative w-12 h-7 rounded-full flex-shrink-0 transition-colors duration-300 ease-in-out focus:outline-none shadow-inner ${active ? 'bg-teal-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ease-in-out ${active ? 'left-6' : 'left-1'}`} />
                </button>
                
                <span className={`flex-1 text-[15px] tracking-tight ${active ? 'font-bold text-gray-800 dark:text-gray-100' : 'font-medium text-gray-500 dark:text-gray-400'}`}>
                  {sec.label}
                </span>
                
                {/* Botões de Ordem */}
                <div className={`flex flex-col gap-1 transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  <button
                    onClick={() => handleMove(sec.id, 'up')}
                    disabled={idx === 0}
                    className="p-1.5 text-gray-400 hover:text-teal-600 bg-gray-50 dark:bg-slate-700/50 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg disabled:opacity-20 disabled:hover:bg-gray-50 transition-colors active:scale-95"
                  >
                    <MoveUp size={16} />
                  </button>
                  <button
                    onClick={() => handleMove(sec.id, 'down')}
                    disabled={idx === localOrder.length - 1}
                    className="p-1.5 text-gray-400 hover:text-teal-600 bg-gray-50 dark:bg-slate-700/50 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg disabled:opacity-20 disabled:hover:bg-gray-50 transition-colors active:scale-95"
                  >
                    <MoveDown size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-white dark:bg-slate-800 p-6 border-t border-gray-50 dark:border-slate-700/50">
          <button
            onClick={handleSave}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[24px] font-bold text-[16px] flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-lg shadow-teal-600/30"
          >
            <Save size={20} /> Guardar Alterações
          </button>
        </div>
      </div>
    </div>
  )
}
