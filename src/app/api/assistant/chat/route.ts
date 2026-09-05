// src/app/api/assistant/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type FinancialAssistantContext = {
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

function getAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Supabase não configurado no servidor.')
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function sanitizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return []

  return input
    .slice(-30)
    .flatMap((item: any) => {
      const role =
        item?.role === 'assistant'
          ? 'assistant'
          : item?.role === 'user'
            ? 'user'
            : null

      const content =
        typeof item?.content === 'string'
          ? item.content.trim().slice(0, 4000)
          : ''

      if (!role || !content) return []

      return [{ role, content }]
    })
}

function sanitizeFinancialContext(
  input: any
): FinancialAssistantContext {
  const safeNumber = (value: unknown) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const categories = Array.isArray(
    input?.topExpenseCategories
  )
    ? input.topExpenseCategories
        .slice(0, 8)
        .flatMap((item: any) => {
          const name =
            typeof item?.name === 'string'
              ? item.name.trim().slice(0, 80)
              : ''

          const amount = safeNumber(item?.amount)

          return name ? [{ name, amount }] : []
        })
    : []

  return {
    context:
      typeof input?.context === 'string'
        ? input.context.slice(0, 40)
        : 'unknown',
    generatedAt:
      typeof input?.generatedAt === 'string'
        ? input.generatedAt.slice(0, 40)
        : new Date().toISOString(),
    accountBalance: safeNumber(input?.accountBalance),
    currentMonthIncome: safeNumber(
      input?.currentMonthIncome
    ),
    currentMonthExpense: safeNumber(
      input?.currentMonthExpense
    ),
    currentMonthNet: safeNumber(
      input?.currentMonthNet
    ),
    transactionCount: Math.max(
      0,
      Math.trunc(
        safeNumber(input?.transactionCount)
      )
    ),
    topExpenseCategories: categories,
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization =
      request.headers.get('authorization')

    const accessToken =
      authorization?.startsWith('Bearer ')
        ? authorization.slice(7).trim()
        : ''

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Sessão não autenticada.' },
        { status: 401 }
      )
    }

    const supabase = getAuthClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Sessão inválida ou expirada.' },
        { status: 401 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini não configurado no servidor.' },
        { status: 503 }
      )
    }

    const body = await request.json()

    const messages =
      sanitizeMessages(body?.messages)

    const financialContext =
      sanitizeFinancialContext(
        body?.financialContext
      )

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'Mensagem obrigatória.' },
        { status: 400 }
      )
    }

    const snapshot = JSON.stringify(
      financialContext,
      null,
      2
    )

    const systemInstruction = `Você é o assistente financeiro do DFL Finance.

Responda em português do Brasil, de forma clara, prática e concisa.

Use o snapshot financeiro abaixo como a única fonte para números atuais do usuário.
Nunca invente saldo, gasto, receita, categoria, tendência ou transação que não esteja no snapshot ou nas mensagens.
Quando a pergunta exigir um dado que o snapshot não contém, diga explicitamente que esse dado não está disponível no contexto atual.
Não afirme que tem acesso direto a banco, conta bancária, internet ou dados fora do snapshot.
Diferencie saldo das contas de fluxo do mês.
Valores estão em BRL.

SNAPSHOT FINANCEIRO:
${snapshot}`

    const genAI =
      new GoogleGenerativeAI(apiKey)

    const model =
      genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction,
      })

    const contents =
      messages.map((message) => ({
        role:
          message.role === 'assistant'
            ? 'model'
            : 'user',
        parts: [{ text: message.content }],
      }))

    const result =
      await model.generateContent({
        contents,
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 1200,
        },
      })

    const message =
      result.response.text()?.trim()

    if (!message) {
      return NextResponse.json(
        {
          error:
            'O assistente retornou uma resposta vazia.',
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ message })
  } catch (error: any) {
    console.error(
      'Erro no assistente financeiro:',
      error
    )

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Erro ao consultar o assistente.',
      },
      { status: 500 }
    )
  }
}
