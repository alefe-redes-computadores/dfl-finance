// src/components/admin/AdminDataViewer.tsx
'use client'

import { useState } from 'react'
import { db } from '@/lib/db'

export function AdminDataViewer() {
  const [data, setData] = useState<any[] | null>(null)

  const viewTable = async (tableName: string) => {
    // @ts-ignore
    const result = await db[tableName].limit(5).toArray()
    setData(result)
  }

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700">
      <h3 className="font-bold mb-4 dark:text-white">Explorar Tabelas</h3>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {['transactions', 'accounts', 'categories'].map(t => (
          <button key={t} onClick={() => viewTable(t)} className="text-xs py-2 bg-gray-100 dark:bg-slate-700 rounded-lg">{t}</button>
        ))}
      </div>
      <pre className="text-[10px] bg-slate-900 text-green-400 p-3 rounded-lg overflow-x-auto h-32">
        {data ? JSON.stringify(data, null, 2) : "// Selecione uma tabela"}
      </pre>
    </div>
  )
}
