// src/lib/notificationUtils.ts
import { db } from './db'
import { supabase } from './supabase'

/**
 * 🔥 Gera uma chave única para verificação de duplicatas
 * Ex: user-123-invoice_soon-2026-07-13
 */
export function generateNotificationKey(userId: string, type: string, date: string): string {
  return `${userId}-${type}-${date}`
}

/**
 * 🔥 Verifica se já existe uma notificação com a mesma chave no banco local
 */
export async function hasDuplicateNotification(
  userId: string,
  type: string,
  date: string
): Promise<boolean> {
  try {
    const key = generateNotificationKey(userId, type, date)
    const existing = await db.table('notifications')
      .where('user_id')
      .equals(userId)
      .and((n: any) => n.unique_key === key || (n.type === type && n.created_at?.startsWith(date)))
      .first()
    
    return !!existing
  } catch (err) {
    console.error('❌ [NotificationUtils] Erro ao verificar duplicata:', err)
    return false
  }
}

/**
 * 🔥 Limpa todas as notificações (local + servidor)
 * Retorna { success: boolean, error?: string }
 */
export async function clearAllNotifications(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Limpa o banco local (Dexie)
    await db.table('notifications').clear()
    console.log('✅ [NotificationUtils] Notificações locais limpas com sucesso.')

    // 2. Limpa o banco remoto (Supabase)
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)

    if (error) {
      console.error('❌ [NotificationUtils] Erro ao limpar notificações no Supabase:', error)
      return { success: false, error: error.message }
    }

    console.log('✅ [NotificationUtils] Notificações do Supabase limpas com sucesso.')
    return { success: true }
  } catch (err: any) {
    console.error('❌ [NotificationUtils] Erro inesperado:', err)
    return { success: false, error: err.message }
  }
}