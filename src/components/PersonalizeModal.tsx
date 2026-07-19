'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd'
import { X, Save, LayoutGrid, GripVertical, Eye, EyeOff, Lock } from 'lucide-react'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

interface Section {
  id: string
  label: string
  description?: string
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

// ✅ Seções que NÃO podem ser desativadas (sempre visíveis)
const FIXED_SECTIONS = ['balance', 'income-expense', 'pendings', 'accounts', 'cards', 'recent']

export default function PersonalizeModal({
  isOpen,
  onClose,
  sections,
  enabled,
  order,
  onToggle,
  onMove,
  onSave,
}: Props) {
  const { vibrate } = useHapticFeedback()
  const [mounted, setMounted] = useState(false)
  const [localOrder, setLocalOrder] = useState<Section[]>(order)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    setLocalOrder(order)
  }, [order])

  // ✅ Handler do Drag & Drop
  const handleDragEnd = (result: DropResult) => {
    setIsDragging(false)

    if (!result.destination) return

    const sourceIndex = result.source.index
    const destIndex = result.destination.index

    if (sourceIndex === destIndex) return

    // Reordena a lista local
    const newItems = Array.from(localOrder)
    const [removed] = newItems.splice(sourceIndex, 1)
    newItems.splice(destIndex, 0, removed)

    setLocalOrder(newItems)

    // Calcula a direção e aplica a movimentação
    const item = removed
    const direction = destIndex > sourceIndex ? 'down' : 'up'

    // Aplica a movimentação no estado pai
    // Como temos uma lista reordenada, precisamos encontrar a nova posição
    const newIndex = newItems.findIndex(s => s.id === item.id)
    const currentIndex = order.findIndex(s => s.id === item.id)

    if (newIndex !== currentIndex) {
      const steps = Math.abs(newIndex - currentIndex)
      for (let i = 0; i < steps; i++) {
        onMove(item.id, direction)
      }
    }
  }

  const handleDragStart = () => {
    setIsDragging(true)
    vibrate([5])
  }

  if (!isOpen || !mounted) return null

  const modalContent = (
    <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
      
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[32px] shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-8 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex-shrink-0 flex justify-center pt-4 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 bg-white dark:bg-slate-800 px-6 pt-2 pb-4 border-b border-gray-100 dark:border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[16px] bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center shadow-sm">
                <LayoutGrid size={22} className="text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h2 className="font-bold text-[20px] text-gray-800 dark:text-gray-100 tracking-tight">
                  Personalizar início
                </h2>
                <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">
                  Arraste pelo punho para reordenar e toque no olho para mostrar/esconder
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 bg-gray-50 dark:bg-slate-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full transition-colors active:scale-95"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Lista de seções com Drag & Drop */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
            <Droppable droppableId="sections">
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`space-y-2 transition-colors duration-200 ${
                    snapshot.isDraggingOver ? 'bg-teal-50/30 dark:bg-teal-900/10 rounded-[24px] p-1' : ''
                  }`}
                >
                  {localOrder.map((sec, index) => {
                    const isActive = enabled.has(sec.id)
                    const isFixed = FIXED_SECTIONS.includes(sec.id)

                    return (
                      <Draggable
                        key={sec.id}
                        draggableId={sec.id}
                        index={index}
                        isDragDisabled={isFixed}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center gap-3 p-3 rounded-[20px] transition-all ${
                              snapshot.isDragging
                                ? 'bg-white dark:bg-slate-800 shadow-lg ring-2 ring-teal-500/30 scale-[1.02]'
                                : isActive
                                ? 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                                : 'bg-gray-50/70 dark:bg-slate-800/30 opacity-60'
                            } ${isFixed ? 'border-l-4 border-teal-500' : 'border border-transparent'}`}
                          >
                            {/* Grip (ícone de arrastar) */}
                            <div
                              {...provided.dragHandleProps}
                              className={`shrink-0 p-1.5 rounded-full ${
                                isFixed
                                  ? 'cursor-not-allowed opacity-30 text-gray-300 dark:text-gray-600'
                                  : 'cursor-grab text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                              }`}
                            >
                              <GripVertical size={18} />
                            </div>

                            {/* Switch/Ativação */}
                            <button
                              onClick={() => {
                                vibrate([5])
                                onToggle(sec.id)
                              }}
                              className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-300 ease-in-out focus:outline-none shadow-inner ${
                                isActive ? 'bg-teal-500' : 'bg-gray-300 dark:bg-slate-600'
                              }`}
                              disabled={isFixed}
                            >
                              <div
                                className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-300 ease-in-out ${
                                  isActive ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>

                            {/* Conteúdo */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p
                                  className={`text-[14px] font-semibold truncate ${
                                    isActive
                                      ? 'text-gray-900 dark:text-gray-100'
                                      : 'text-gray-400 dark:text-gray-500'
                                  }`}
                                >
                                  {sec.label}
                                </p>
                                {isFixed && (
                                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-1.5 py-0.5 rounded-full">
                                    Fixo
                                  </span>
                                )}
                              </div>
                              {sec.description && (
                                <p
                                  className={`text-[11px] font-medium truncate ${
                                    isActive
                                      ? 'text-gray-400 dark:text-gray-500'
                                      : 'text-gray-300 dark:text-gray-600'
                                  }`}
                                >
                                  {sec.description}
                                </p>
                              )}
                            </div>

                            {/* Ícone de olho (mostrar/esconder) */}
                            <button
                              onClick={() => {
                                if (isFixed) {
                                  vibrate([5])
                                  return
                                }
                                vibrate([5])
                                onToggle(sec.id)
                              }}
                              className={`shrink-0 p-1.5 rounded-full transition-all active:scale-95 ${
                                isFixed
                                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                  : isActive
                                  ? 'text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20'
                                  : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'
                              }`}
                              title={isFixed ? 'Seção fixa' : isActive ? 'Ocultar seção' : 'Mostrar seção'}
                            >
                              {isFixed ? <Lock size={16} /> : isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                            </button>

                            {/* Indicador de posição */}
                            <span className="shrink-0 text-[10px] font-medium text-gray-400 dark:text-gray-500 w-5 text-right">
                              {index + 1}
                            </span>
                          </div>
                        )}
                      </Draggable>
                    )
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-white dark:bg-slate-800 px-6 pt-4 pb-6 border-t border-gray-100 dark:border-slate-700/50">
          <div className="flex gap-3">
            <button
              onClick={() => {
                vibrate([5])
                onClose()
              }}
              className="flex-1 py-3.5 rounded-[20px] bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-bold text-[14px] transition-colors hover:bg-gray-200 dark:hover:bg-slate-700 active:scale-[0.98]"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                vibrate([10, 50])
                onSave()
              }}
              className="flex-1 py-3.5 rounded-[20px] bg-teal-600 hover:bg-teal-700 text-white font-bold text-[14px] shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Guardar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}