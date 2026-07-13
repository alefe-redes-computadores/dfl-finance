// src/components/admin/AdminStatus.tsx
export function AdminStatus() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
        <p className="text-[10px] text-blue-600 uppercase font-bold">Online</p>
        <p className="font-mono dark:text-white">{typeof navigator !== 'undefined' ? (navigator.onLine ? 'Sim' : 'Não') : '...'}</p>
      </div>
      <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-2xl border border-purple-100 dark:border-purple-800">
        <p className="text-[10px] text-purple-600 uppercase font-bold">Resolução</p>
        <p className="font-mono dark:text-white">
          {typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : '...'}
        </p>
      </div>
    </div>
  )
}
