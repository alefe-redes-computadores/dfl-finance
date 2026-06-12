'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Home, ArrowLeftRight, BarChart2, MoreHorizontal } from 'lucide-react'

const tabs = [
  { href: '/home', icon: Home, label: 'Início' },
  { href: '/transactions', icon: ArrowLeftRight, label: 'Transações' },
  { href: '/analysis', icon: BarChart2, label: 'Análise' },
  { href: '/more', icon: MoreHorizontal, label: 'Mais' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 safe-bottom z-50">
      <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
        {tabs.map((tab, i) => {
          const active = pathname === tab.href
          const Icon = tab.icon

          if (i === 2) {
            return (
              <>
                {/* FAB central */}
                <button
                  key="fab"
                  onClick={() => router.push('/new-transaction')}
                  className="w-14 h-14 bg-brand-teal rounded-full flex items-center justify-center shadow-lg -mt-6"
                >
                  <span className="text-white text-3xl font-light leading-none">+</span>
                </button>
                <button
                  key={tab.href}
                  onClick={() => router.push(tab.href)}
                  className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px]"
                >
                  <Icon
                    size={22}
                    className={active ? 'text-brand-teal' : 'text-gray-400 dark:text-gray-500'}
                  />
                  <span className={`text-[10px] ${active ? 'text-brand-teal font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                    {tab.label}
                  </span>
                </button>
              </>
            )
          }

          return (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              className="flex flex-col items-center gap-1 px-3 py-1 min-w-[56px]"
            >
              <Icon
                size={22}
                className={active ? 'text-brand-teal' : 'text-gray-400 dark:text-gray-500'}
              />
              <span className={`text-[10px] ${active ? 'text-brand-teal font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
