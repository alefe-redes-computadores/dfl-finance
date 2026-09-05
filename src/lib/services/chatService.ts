// src/lib/services/chatService.ts
import { supabase } from '@/lib/supabase'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface FinancialAssistantContext {
  context: string
  generatedAt: string
  accountBalance: number
  currentMonthIncome: number
  currentMonthExpense: number
  currentMonthNet: number
  transactionCount: number
  topExpenseCategories: Array<{
    name: string
    amount: number
  }>
}

export async function sendChatMessage(
  messages: ChatMessage[],
  financialContext: FinancialAssistantContext
): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Sessão expirada. Entre novamente.')
  }

  const response = await fetch('/api/assistant/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      messages,
      financialContext,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data?.error || 'Não foi possível consultar o assistente.'
    )
  }

  if (
    typeof data?.message !== 'string' ||
    !data.message.trim()
  ) {
    throw new Error('O assistente retornou uma resposta vazia.')
  }

  return data.message.trim()
}
