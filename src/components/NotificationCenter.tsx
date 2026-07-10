  // ... (o restante permanece igual)

  const markAsRead = async (notifIds: string[]) => {
    if (!user || processing) return
    setProcessing(true)

    try {
      for (const notifId of notifIds) {
        // 🔥 PADRONIZANDO AMBOS OS CAMPOS
        const updateData = {
          is_read: true,
          read: true,
          updated_at: new Date().toISOString()
        }
        await db.table('notifications').update(notifId, updateData)
        await addToSyncQueue(user.id, 'notifications', 'update', notifId, updateData)
      }

      // 🔥 ATUALIZA O ESTADO LOCAL IMEDIATAMENTE (O segredo pra não "ressurgir")
      const updated = localNotifs.map((n: any) => {
        if (notifIds.includes(n.id)) {
          return { ...n, is_read: true, read: true }
        }
        return n
      })
      setLocalNotifs(updated)

      const unread = updated.filter((n: any) => !n.is_read && !n.read).length
      if (onReadChange) onReadChange(unread)

    } catch (err: any) {
      console.error('Erro ao marcar como lida:', err)
      showToast(`Erro ao processar: ${err.message}`, 'error')
    } finally {
      setProcessing(false)
    }
  }

  // ... (restante do código)
