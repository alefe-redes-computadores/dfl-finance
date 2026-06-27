'use client'

import { useState, useEffect } from 'react'
import { MoveUp, MoveDown, ToggleLeft, ToggleRight, X, Save } from 'lucide-react'

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

  useEffect(() => {
    setLocalOrder(order)
  }, [order])

  const handleMove = (id: string, dir: 'up' | 'down') => {
    const idx = localOrder.findIndex(s => s.id === id)
    if (idx === -1) return
    const newOrder = [...localOrder]
    const target = dir === 'up' ? idx - 1 : idx + 1
    if (target >= 0 && target < newOrder.length) {
      // Animação: marca o item como animando
      setAnimatingId(id)
      setTimeout(() => setAnimatingId(null), 300)
      
      // Troca
      [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]]
      setLocalOrder(newOrder)
    }
    onMove(id, dir)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-2xl animate-slide-up z-10 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100">Personalizar Tela</h2>
          <button onClick={onClose} className="p-2 text-gray-400"><X size={20} /></button>
        </div>
        <p className="text-xs text-gray-400 mb-4">Ative/desative e reordene as seções.</p>

        <div className="space-y-2">
          {localOrder.map((sec, idx) => {
            const active = enabled.has(sec.id)
            const isAnimating = animatingId === sec.id
            return (
              <div
                key={sec.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                  active ? 'bg-white dark:bg-slate-700 shadow-sm' : 'bg-gray-100 dark:bg-slate-800 opacity-50'
                } ${isAnimating ? 'scale-[1.02] shadow-md' : 'scale-100'}`}
              >
                <button onClick={() => onToggle(sec.id)} className="flex-shrink-0">
                  {active ? <ToggleRight size={24} className="text-teal-600" /> : <ToggleLeft size={24} className="text-gray-400" />}
                </button>
                <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{sec.label}</span>
                {active && (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleMove(sec.id, 'up')}
                      disabled={idx === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                    >
                      <MoveUp size={16} />
                    </button>
                    <button
                      onClick={() => handleMove(sec.id, 'down')}
                      disabled={idx === localOrder.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                    >
                      <MoveDown size={16} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button
          onClick={onSave}
          className="w-full mt-6 bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <Save size={20} /> Salvar Personalização
        </button>
      </div>
    </div>
  )
}