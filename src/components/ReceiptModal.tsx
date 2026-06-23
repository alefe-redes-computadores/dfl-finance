'use client'

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  onOptionSelect: (option: string) => void
}

export default function ReceiptModal({ isOpen, onClose, onOptionSelect }: ReceiptModalProps) {
  if (!isOpen) return null

  const options = [
    { id: 'galeria', label: 'Galeria', desc: 'Screenshot ou foto do comprovante' },
    { id: 'camera', label: 'Câmera', desc: 'Tirar foto agora' },
    { id: 'pdf', label: 'PDF', desc: 'Arquivo de comprovante do banco' }
  ]

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-2">Importar comprovante</h3>
        <p className="text-sm text-gray-500 mb-6">Lemos valor, descrição e data do comprovante e preenchemos aqui mesmo.</p>
        
        <div className="space-y-4">
          {options.map(opt => (
            <button 
              key={opt.id} 
              onClick={() => onOptionSelect(opt.id)}
              className="w-full text-left p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-gray-800">{opt.label}</div>
              <div className="text-xs text-gray-400">{opt.desc}</div>
            </button>
          ))}
        </div>

        <button onClick={onClose} className="w-full mt-6 py-4 font-bold text-gray-700">
          Cancelar
        </button>
      </div>
    </div>
  )
}
