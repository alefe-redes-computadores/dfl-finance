'use client'

import { useState } from 'react'
import { X, Filter, Check } from 'lucide-react'

export default function FilterDrawer({ isOpen, onClose, onApply, accounts, categories }: any) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl p-6 h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg text-gray-800 dark:text-white">Filtros</h3>
          <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full"><X size={20} /></button>
        </div>
        
        {/* Aqui você adicionará as listas de seleção de Contas e Categorias */}
        <p className="text-gray-500 text-sm">Em breve: Seleção de contas e categorias para filtrar seus gráficos!</p>
        
        <button onClick={onApply} className="w-full bg-teal-700 text-white py-4 rounded-2xl font-bold mt-8">
          Aplicar Filtros
        </button>
      </div>
    </div>
  )
}

