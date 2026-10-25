// V204 — Resumo da Inbox, sem acesso ao ledger ou banco.
// reviewCount e subconjunto de actionableCount.
export function homeInboxSummary(
  actionableCount: number,
  reviewCount: number
) {
  const total = Number.isFinite(actionableCount)
    ? Math.max(0, Math.floor(actionableCount))
    : 0
  const review = Number.isFinite(reviewCount)
    ? Math.min(total, Math.max(0, Math.floor(reviewCount)))
    : 0
  const other = total - review

  const title = total === 0
    ? 'Tudo em dia'
    : review > 0
      ? `${review} para revisar`
      : `${total} pendente${total === 1 ? '' : 's'}`

  const detail = total === 0
    ? 'Nenhuma ação imediata identificada'
    : review > 0 && other > 0
      ? `${other} outra${other === 1 ? ' pendência' : 's pendências'}`
      : review > 0
        ? 'Conferir categorias, contas e comprovantes'
        : 'Conferir pendências da Inbox'

  return {
    title,
    detail,
    accessible: `Abrir Inbox financeira. ${title}. ${detail}`,
    review,
    other,
    total
  }
}
