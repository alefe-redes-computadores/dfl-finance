'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { 
  Plus, 
  TrendingDown, 
  TrendingUp, 
  Eye, 
  EyeOff, 
  FileUp,
  CreditCard,
  Scan,
  Wallet,
  ArrowDown,
  ArrowUp,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  FileText,
  Users,
  Target,
  BarChart3,
  Check,
  ChevronDown,
  ArrowRight,
  Clock,
  Ban,
  User
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

// COMPONENTES
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContextToggle } from '@/components/ContextToggle'
import { InstallBanner } from '@/components/InstallBanner'
import ProjectionSparklineCard from '@/components/ProjectionSparklineCard'


// FUNÇÕES E TIPOS
import { cn, formatCurrency } from '@/lib/utils'

// Tipo para a seção "Mais"
type MaisItem = {
  id: string
  title: string
  description: string
  icon: string
  href: string
  badge?: string
}

// Tipo de menu lateral
type SidebarItem = {
  id: string
  label: string
  icon: React.ReactNode
  href: string
  badge?: string
}

// ============================================
// PÁGINA HOME
// ============================================
export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()

  // Estados
  const [user, setUser] = useState<any>(null)
  const [context, setContext] = useState<'pf' | 'pj'>('pf')
  const [hideValues, setHideValues] = useState(false)
  const [totalBalance, setTotalBalance] = useState(0)
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [recentTransactions, setRecentTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Busca contexto inicial
  useEffect(() => {
    const storedContext = localStorage.getItem('dfl-context') as 'pf' | 'pj' | null
    if (storedContext === 'pf' || storedContext === 'pj') {
      setContext(storedContext)
    }
  }, [])

  // Dados da Home
  const fetchHomeData = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return router.push('/login')
    setUser(currentUser)

    try {
      // Saldo, receita e despesa do mês
      const hoje = new Date()
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0]

      const { data: txMes } = await supabase
        .from('transactions')
        .select('amount, type, status')
        .eq('user_id', currentUser.id)
        .eq('context', context)
        .gte('date', inicioMes)
        .lte('date', fimMes)

      if (txMes) {
        const doneTx = txMes.filter(t => t.status === 'done')
        const income = doneTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
        const expense = doneTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
        const pending = txMes.filter(t => t.status === 'pending').length

        setTotalIncome(income)
        setTotalExpense(expense)
        setTotalBalance(income - expense)
        setPendingCount(pending)
      }

      // Transações recentes
      const { data: recentTx } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('context', context)
        .order('date', { ascending: false })
        .limit(5)

      setRecentTransactions(recentTx || [])
    } catch (err) {
      console.error('Erro ao buscar dados da Home:', err)
    } finally {
      setLoading(false)
    }
  }, [context, supabase, router])

  useEffect(() => {
    fetchHomeData()
  }, [fetchHomeData])

  // Alterna contexto
  const toggleContext = (newContext: 'pf' | 'pj') => {
    setContext(newContext)
    localStorage.setItem('dfl-context', newContext)
    setLoading(true)
  }

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Menu lateral
  const sidebarItems: SidebarItem[] = [
    {
      id: 'home',
      label: 'Início',
      icon: <Wallet className="w-5 h-5" />,
      href: '/home',
    },
    {
      id: 'transactions',
      label: 'Transações',
      icon: <FileText className="w-5 h-5" />,
      href: '/transactions',
    },
    {
      id: 'cards',
      label: 'Cartões',
      icon: <CreditCard className="w-5 h-5" />,
      href: '/cards',
    },
    {
      id: 'reports',
      label: 'Relatórios',
      icon: <BarChart3 className="w-5 h-5" />,
      href: '/reports',
    },
    {
      id: 'analysis',
      label: 'Análises',
      icon: <BarChart3 className="w-5 h-5" />,
      href: '/analysis',
    },
    {
      id: 'contacts',
      label: 'Contatos',
      icon: <Users className="w-5 h-5" />,
      href: '/contacts',
    },
    {
      id: 'notifications',
      label: 'Notificações',
      icon: <Bell className="w-5 h-5" />,
      href: '/notifications',
      badge: pendingCount > 0 ? String(pendingCount) : undefined,
    },
    {
      id: 'settings',
      label: 'Configurações',
      icon: <Settings className="w-5 h-5" />,
      href: '/settings',
    },
  ]

  // Itens do "Mais"
  const maisItems: MaisItem[] = [
    {
      id: 'contacts',
      title: 'Contatos',
      description: 'Fornecedores e clientes',
      icon: 'Users',
      href: '/contacts',
    },
    {
      id: 'analysis',
      title: 'Análises',
      description: 'Gráficos e tendências',
      icon: 'BarChart3',
      href: '/analysis',
    },
    {
      id: 'import',
      title: 'Importar Fatura',
      description: 'OFX ou PDF com IA',
      icon: 'FileUp',
      href: '/import-invoice',
    },
    {
      id: 'cards',
      title: 'Meus Cartões',
      description: 'Gerencie seus cartões de crédito',
      icon: 'CreditCard',
      href: '/cards',
    },
    {
      id: 'notifications',
      title: 'Notificações',
      description: 'Alertas e lembretes',
      icon: 'Bell',
      href: '/notifications',
    },
    {
      id: 'goals',
      title: 'Metas',
      description: 'Defina e acompanhe objetivos',
      icon: 'Target',
      href: '/goals',
    },
  ]

  const getIcon = (iconName: string) => {
    const icons: Record<string, React.ReactNode> = {
      Users: <Users className="w-5 h-5" />,
      BarChart3: <BarChart3 className="w-5 h-5" />,
      FileUp: <FileUp className="w-5 h-5" />,
      CreditCard: <CreditCard className="w-5 h-5" />,
      Bell: <Bell className="w-5 h-5" />,
      Target: <Target className="w-5 h-5" />,
    }
    return icons[iconName] || <FileText className="w-5 h-5" />
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="shrink-0"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">DFL Finance</h1>
          </div>

          <ContextToggle context={context} onToggle={toggleContext} />
        </div>
      </header>

      {/* SIDEBAR OVERLAY */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <div
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-72 bg-white dark:bg-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out overflow-y-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Menu</h2>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="p-2 space-y-1">
          {sidebarItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                item.id === 'home'
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              )}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}

          <hr className="my-2 border-slate-200 dark:border-slate-700" />

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        </nav>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <InstallBanner />

        {/* SALDO TOTAL */}
        {loading ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : (
          <Card className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Saldo Total
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setHideValues(!hideValues)}
                  className="h-8 w-8"
                >
                  {hideValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p
                className={cn(
                  'text-3xl font-normal',
                  totalBalance >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                )}
              >
                {hideValues ? '••••••' : `${totalBalance >= 0 ? '+' : '-'}${formatCurrency(Math.abs(totalBalance))}`}
              </p>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                    <ArrowUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Receitas</p>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {hideValues ? '••••••' : formatCurrency(totalIncome)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                    <ArrowDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Despesas</p>
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                      {hideValues ? '••••••' : formatCurrency(totalExpense)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PROJEÇÃO DE SALDO (SPARKLINE) */}
        <ProjectionSparklineCard />

        {/* CARDS DE AÇÃO RÁPIDA */}
        <div className="grid grid-cols-4 gap-3">
          <Link
            href="/transactions/new"
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
              <Plus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 text-center">Nova Transação</span>
          </Link>

          <Link
            href="/import-invoice"
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <FileUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 text-center">Importar Fatura</span>
          </Link>

          <Link
            href="/transactions/new?ocr=true"
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <Scan className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 text-center">Ler Comprovante</span>
          </Link>

          <Link
            href="/cards"
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 text-center">Meus Cartões</span>
          </Link>
        </div>

        {/* TRANSAÇÕES RECENTES */}
        <Card className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Transações Recentes
            </CardTitle>
            <Link
              href="/transactions"
              className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="text-center py-6">
                <Ban className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma transação recente</p>
                <Link href="/transactions/new">
                  <Button variant="link" className="mt-1 text-emerald-600 dark:text-emerald-400 text-sm">
                    Criar primeira transação
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentTransactions.map((tx: any) => (
                  <Link
                    key={tx.id}
                    href={`/transactions/${tx.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                        tx.type === 'income'
                          ? 'bg-emerald-100 dark:bg-emerald-900'
                          : 'bg-red-100 dark:bg-red-900'
                      )}
                    >
                      {tx.type === 'income' ? (
                        <ArrowUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <ArrowDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {tx.description || 'Sem descrição'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {format(parseISO(tx.date), "dd 'de' MMM", { locale: ptBR })}
                        {tx.status === 'pending' && (
                          <span className="ml-2 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <Clock className="w-3 h-3" /> Pendente
                          </span>
                        )}
                      </p>
                    </div>
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        tx.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {hideValues ? '•••' : formatCurrency(tx.amount)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* SEÇÃO MAIS */}
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-3">Mais</h2>
          <div className="grid grid-cols-2 gap-3">
            {maisItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    {getIcon(item.icon)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {item.description}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 -rotate-90" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>

      {/* BARRA INFERIOR MOBILE */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-lg">
        <div className="flex items-center justify-around py-2 max-w-5xl mx-auto">
          <Link
            href="/home"
            className="flex flex-col items-center gap-0.5 text-emerald-600 dark:text-emerald-400"
          >
            <Wallet className="w-5 h-5" />
            <span className="text-[10px] font-medium">Início</span>
          </Link>
          <Link
            href="/transactions"
            className="flex flex-col items-center gap-0.5 text-slate-400 dark:text-slate-500"
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px] font-medium">Transações</span>
          </Link>
          <Link
            href="/transactions/new"
            className="flex flex-col items-center gap-0.5 text-slate-400 dark:text-slate-500"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center -mt-4 shadow-lg">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <span className="text-[10px] font-medium">Nova</span>
          </Link>
          <Link
            href="/reports"
            className="flex flex-col items-center gap-0.5 text-slate-400 dark:text-slate-500"
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px] font-medium">Relatórios</span>
          </Link>
          <Link
            href="/settings"
            className="flex flex-col items-center gap-0.5 text-slate-400 dark:text-slate-500"
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px] font-medium">Ajustes</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}