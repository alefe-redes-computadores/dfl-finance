import fs from 'node:fs'
import assert from 'node:assert/strict'
const r=p=>fs.readFileSync(p,'utf8')
const u=r('src/lib/userSettings.ts'),n=r('src/lib/nativeNotifications.ts'),p=r('src/components/NotificationPreferencesCard.tsx'),c=r('src/app/(app)/assistant/chat/page.tsx')
const cases=[
 ['V166-A permanece ativa',u.includes('default_accounts: DefaultAccountMap')],
 ['Agrupamento é escolha do usuário',u.includes('notification_grouping: boolean')],
 ['Ação Abrir é escolha do usuário',u.includes('notification_action_open: boolean')],
 ['Preferências normalizadas',u.includes('typeof raw.notification_grouping')&&u.includes('typeof raw.notification_action_open')],
 ['Grupo Android isolado por data e hora',n.includes('`dfl-finance-${toISODate(when)}-${when.getHours()}`')],
 ['Apenas grupos com mais de um lembrete',n.includes('groupItems.length < 2')],
 ['Capacidade máxima de notificações preservada',n.includes('notifications.length >= 60')],
 ['Resumo roteado à central',n.includes("route: '/notifications'")],
 ['Grupo registra identificador',n.includes('groupSummary: true')],
 ['Iteração Map compatível com compilação TypeScript do projeto',n.includes('Array.from(grouped.entries())')&&!n.includes('of grouped)')],
 ['Ação aberta no primeiro plano',n.includes("id: 'open', title: 'Abrir', foreground: true")],
 ['Ação falha sem impedir agenda',n.includes('Ação Abrir indisponível; toque padrão mantido')],
 ['Rota protegida por normalização',n.includes('normalizeNativeNotificationRoute(')],
 ['Sem quitação silenciosa no Android',!n.includes('conciliatePendingTransaction(')&&!n.includes('applyAccountCashDelta(')],
 ['Apresentação personalizável',p.includes("notification_grouping' as const")&&p.includes("notification_action_open' as const")],
 ['Chat mantém streaming',c.includes('await streamChatMessage(')],
 ['Chat limita pintura visual',c.includes('now - lastStreamPaint >= 85')],
 ['Chat mantém persistência após resposta',c.includes('await persistMessage(')],
]
for(const [label,ok] of cases){assert(ok,label);console.log('✓',label)}
console.log(`V166-B: ${cases.length} contratos aprovados`)
