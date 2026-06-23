'use client'

interface ComingSoonModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
}

export default function ComingSoonModal({ isOpen, onClose, title = "Funcionalidade em breve" }: ComingSoonModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-3xl p-8 text-center" onClick={e => e.stopPropagation()}>
        <div className="w-16 h-16 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🚀</span>
        </div>
        <h3 className="font-bold text-xl mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-8">
          Ops! Esta funcionalidade estará disponível em breve no nosso aplicativo. Estamos trabalhando para deixar tudo pronto para você.
        </p>
        <button 
          onClick={onClose} 
          className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
