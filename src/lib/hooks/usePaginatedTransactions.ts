'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface UsePaginatedTransactionsProps {
  context?: 'dfl' | 'personal'
  category?: string
  startDate?: string
  endDate?: string
  search?: string
  pageSize?: number
}

export function usePaginatedTransactions({
  context,
  category,
  startDate,
  endDate,
  search,
  pageSize = 20,
}: UsePaginatedTransactionsProps = {}) {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  const fetchTransactions = useCallback(async (pageNum: number) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuário não autenticado')

    const from = pageNum * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .range(from, to)

    if (context) query = query.eq('context', context)
    if (category) query = query.eq('category_id', category)
    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)
    if (search) {
      query = query.or(`description.ilike.%${search}%,notes.ilike.%${search}%`)
    }

    const { data, error, count } = await query
    if (error) throw error

    return { data: data || [], count: count || 0 }
  }, [context, category, startDate, endDate, search, pageSize])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    try {
      const { data, count } = await fetchTransactions(page)
      setTransactions(prev => {
        const newTransactions = [...prev, ...data]
        setHasMore(newTransactions.length < count)
        return newTransactions
      })
      setTotalCount(count)
      setPage(prev => prev + 1)
    } catch (error) {
      console.error('Erro ao carregar transações:', error)
    } finally {
      setLoading(false)
    }
  }, [page, fetchTransactions, loading, hasMore])

  useEffect(() => {
    setTransactions([])
    setPage(0)
    setHasMore(true)
    setLoading(true)
    setTotalCount(0)

    fetchTransactions(0)
      .then(({ data, count }) => {
        setTransactions(data)
        setHasMore(data.length < count)
        setTotalCount(count)
        setPage(1)
      })
      .finally(() => setLoading(false))
  }, [context, category, startDate, endDate, search])

  return { 
    transactions, 
    loading, 
    hasMore, 
    loadMore,
    totalCount,
    isEmpty: transactions.length === 0 && !loading
  }
}