// src/lib/notificationUtils.ts
import { db, addToSyncQueue, type LocalNotification } from './db'
import { supabase } from './supabase'

export function generateNotificationKey(
  userId: string,
  type: string,
  date: string
): string {
  return `${userId}-${type}-${date}`
}

export function isNotificationRead(
  notification?: Pick<LocalNotification, 'read' | 'is_read'> | null
) {
  return Boolean(notification?.read || notification?.is_read)
}

export function normalizeNotificationReadState<T extends Record<string, any>>(
  notification: T
): T & { read: boolean; is_read: boolean } {
  const read = Boolean(notification?.read || notification?.is_read)

  return {
    ...notification,
    read,
    is_read: read,
  }
}

export async function hasDuplicateNotification(
  userId: string,
  type: string,
  date: string
): Promise<boolean> {
  try {
    const key = generateNotificationKey(userId, type, date)

    const existing = await db.notifications
      .where('user_id')
      .equals(userId)
      .and(
        (notification: any) =>
          notification.unique_key === key ||
          (
            notification.type === type &&
            notification.created_at?.startsWith(date)
          )
      )
      .first()

    return Boolean(existing)
  } catch (error) {
    console.error(
      '[NotificationUtils] Erro ao verificar duplicata:',
      error
    )
    return false
  }
}

export async function clearAllNotifications(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const localNotifications = await db.notifications
      .where('user_id')
      .equals(userId)
      .toArray()

    if (localNotifications.length > 0) {
      const now = new Date().toISOString()

      await db.transaction(
        'rw',
        db.notifications,
        db.syncQueue,
        async () => {
          for (const notification of localNotifications) {
            await db.notifications.delete(notification.id)

            await addToSyncQueue(
              userId,
              'notifications',
              'delete',
              notification.id,
              {
                id: notification.id,
                user_id: userId,
                deleted_at: now,
              }
            )
          }
        }
      )
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)

    if (error) {
      console.error(
        '[NotificationUtils] Erro ao limpar notificações remotas:',
        error
      )
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    console.error(
      '[NotificationUtils] Erro inesperado ao limpar notificações:',
      error
    )
    return {
      success: false,
      error: error?.message || 'Erro inesperado ao limpar notificações.',
    }
  }
}
