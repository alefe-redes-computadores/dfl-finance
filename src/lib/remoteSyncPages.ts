import { supabase } from '@/lib/supabase'

/** Keyset pagination continues until an empty page, even if the API caps size. */
export async function fetchRemoteSyncRows(table: string, userId: string, since?: string) {
  const rows: any[] = []
  let afterId: string | null = null
  for (;;) {
    let query = supabase.from(table).select('*').eq('user_id', userId).order('id').limit(250)
    if (since) query = query.gte('updated_at', since)
    if (afterId) query = query.gt('id', afterId)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    if (!data?.length) return rows
    const nextId = data[data.length - 1]?.id
    if (typeof nextId !== 'string' || (afterId && nextId <= afterId)) {
      throw new Error('Paginação remota incompleta; nenhum registro será removido.')
    }
    rows.push(...data)
    afterId = nextId
  }
}
