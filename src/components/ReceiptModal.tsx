// src/components/ReceiptModal.tsx
'use client'

import type { ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { Camera, ChevronRight, FileText, Image as ImageIcon, X } from 'lucide-react'

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  onCamera: () => void
  onFileSelect: (file: File) => void
}

export default function ReceiptModal({ isOpen, onClose, onCamera, onFileSelect }: ReceiptModalProps) {
  if (!isOpen || typeof document === 'undefined') return null

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''

    if (!file) return

    onClose()
    onFileSelect(file)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[150000] flex items-end justify-center bg-black/55 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-t-[32px] border border-b-0 border-gray-200/70 bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_60px_rgba(15,23,42,0.18)] animate-in slide-in-from-bottom-6 duration-200 dark:border-slate-700 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Anexar comprovante"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />

        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[20px] font-bold text-gray-900 dark:text-gray-100">Adicionar comprovante</h3>
            <p className="mt-1 text-[12px] leading-5 text-gray-400 dark:text-gray-500">Foto, imagem da galeria ou arquivo PDF.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 active:scale-[0.97] dark:bg-slate-800 dark:text-gray-400"
          >
            <X size={19} />
          </button>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => {
              onClose()
              onCamera()
            }}
            className="flex w-full items-center gap-3 rounded-[20px] border border-gray-200/70 bg-gray-50 p-4 text-left transition-all active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-teal-50 text-teal-600 dark:bg-teal-900/25 dark:text-teal-400">
              <Camera size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-gray-900 dark:text-gray-100">Câmera</p>
              <p className="mt-0.5 text-[12px] text-gray-400">Fotografar o comprovante agora</p>
            </div>
            <ChevronRight size={18} className="text-gray-300 dark:text-slate-600" />
          </button>

          <label className="flex w-full cursor-pointer items-center gap-3 rounded-[20px] border border-gray-200/70 bg-gray-50 p-4 text-left transition-all active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800">
            <input type="file" accept="image/*" className="sr-only" onChange={handleFile} />
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-blue-50 text-blue-600 dark:bg-blue-900/25 dark:text-blue-400">
              <ImageIcon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-gray-900 dark:text-gray-100">Galeria</p>
              <p className="mt-0.5 text-[12px] text-gray-400">Escolher foto ou screenshot</p>
            </div>
            <ChevronRight size={18} className="text-gray-300 dark:text-slate-600" />
          </label>

          <label className="flex w-full cursor-pointer items-center gap-3 rounded-[20px] border border-gray-200/70 bg-gray-50 p-4 text-left transition-all active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800">
            <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={handleFile} />
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400">
              <FileText size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-gray-900 dark:text-gray-100">Arquivo PDF</p>
              <p className="mt-0.5 text-[12px] text-gray-400">Selecionar comprovante em PDF</p>
            </div>
            <ChevronRight size={18} className="text-gray-300 dark:text-slate-600" />
          </label>
        </div>
      </div>
    </div>,
    document.body
  )
}
