// src/app/api/assistant/chat/route.ts
import {
  NextRequest,
  NextResponse,
} from 'next/server'
import {
  GoogleGenerativeAI,
} from '@google/generative-ai'
import {
  createClient,
} from '@supabase/supabase-js'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const GEMINI_START_TIMEOUT_MS = 30000

function assistantTimeoutError() {
  return new Error(
    'O provedor de IA demorou mais que o esperado.'
  )
}

function safeNumber(
  value: unknown
) {
  const parsed =
    Number(value)

  return Number.isFinite(parsed)
    ? parsed
    : 0
}

function getAuthClient() {
  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL

  const anonKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Supabase não configurado no servidor.'
    )
  }

  return createClient(
    url,
    anonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}

function sanitizeMessages(
  input: unknown
): ChatMessage[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input
    .slice(-30)
    .flatMap(
      (item: any) => {
        const role =
          item?.role ===
          'assistant'
            ? 'assistant'
            : item?.role ===
                'user'
              ? 'user'
              : null

        const content =
          typeof item?.content ===
          'string'
            ? item.content
                .trim()
                .slice(0, 4000)
            : ''

        if (
          !role ||
          !content
        ) {
          return []
        }

        return [
          {
            role,
            content,
          },
        ]
      }
    )
}

function sanitizeFinancialContext(
  input: any
) {
  const snapshot =
    input?.snapshot &&
    typeof input.snapshot ===
      'object'
      ? input.snapshot
      : {}

  const categories =
    Array.isArray(
      snapshot
        ?.topExpenseCategories
    )
      ? snapshot
          .topExpenseCategories
          .slice(0, 8)
          .map(
            (item: any) => ({
              name:
                String(
                  item?.name ||
                    ''
                )
                  .trim()
                  .slice(
                    0,
                    80
                  ),
              amount:
                safeNumber(
                  item?.amount
                ),
              share:
                safeNumber(
                  item?.share
                ),
              previousAmount:
                safeNumber(
                  item?.previousAmount
                ),
              deltaPercent:
                item?.deltaPercent ===
                null
                  ? null
                  : safeNumber(
                      item
                        ?.deltaPercent
                    ),
            })
          )
          .filter(
            (item: any) =>
              item.name
          )
      : []

  const insights =
    Array.isArray(
      input?.insights
    )
      ? input.insights
          .slice(0, 8)
          .map(
            (item: any) => ({
              type:
                String(
                  item?.type ||
                    ''
                ).slice(
                  0,
                  60
                ),
              severity:
                String(
                  item?.severity ||
                    'info'
                ).slice(
                  0,
                  20
                ),
              confidence:
                String(
                  item?.confidence ||
                    'low'
                ).slice(
                  0,
                  20
                ),
              title:
                String(
                  item?.title ||
                    ''
                )
                  .trim()
                  .slice(
                    0,
                    120
                  ),
              message:
                String(
                  item?.message ||
                    ''
                )
                  .trim()
                  .slice(
                    0,
                    400
                  ),
              currentValue:
                item
                  ?.currentValue ===
                undefined
                  ? null
                  : safeNumber(
                      item
                        ?.currentValue
                    ),
              baselineValue:
                item
                  ?.baselineValue ===
                undefined
                  ? null
                  : safeNumber(
                      item
                        ?.baselineValue
                    ),
              deltaPercent:
                item
                  ?.deltaPercent ===
                undefined
                  ? null
                  : safeNumber(
                      item
                        ?.deltaPercent
                    ),
              sampleSize:
                Math.max(
                  0,
                  Math.trunc(
                    safeNumber(
                      item
                        ?.sampleSize
                    )
                  )
                ),
            })
          )
          .filter(
            (item: any) =>
              item.title &&
              item.message
          )
      : []

  return {
    context:
      typeof input?.context ===
      'string'
        ? input.context.slice(
            0,
            40
          )
        : 'unknown',

    generatedAt:
      typeof input
        ?.generatedAt ===
      'string'
        ? input
            .generatedAt
            .slice(
              0,
              50
            )
        : new Date()
            .toISOString(),

    snapshot: {
      accountBalance:
        safeNumber(
          snapshot
            ?.accountBalance
        ),

      currentMonthIncome:
        safeNumber(
          snapshot
            ?.currentMonthIncome
        ),

      currentMonthExpense:
        safeNumber(
          snapshot
            ?.currentMonthExpense
        ),

      currentMonthNet:
        safeNumber(
          snapshot
            ?.currentMonthNet
        ),

      previousComparableIncome:
        safeNumber(
          snapshot
            ?.previousComparableIncome
        ),

      previousComparableExpense:
        safeNumber(
          snapshot
            ?.previousComparableExpense
        ),

      previousComparableNet:
        safeNumber(
          snapshot
            ?.previousComparableNet
        ),

      currentWeekIncome:
        safeNumber(
          snapshot
            ?.currentWeekIncome
        ),

      currentWeekExpense:
        safeNumber(
          snapshot
            ?.currentWeekExpense
        ),

      previousWeekIncome:
        safeNumber(
          snapshot
            ?.previousWeekIncome
        ),

      previousWeekExpense:
        safeNumber(
          snapshot
            ?.previousWeekExpense
        ),

      historicalAverageIncome:
        safeNumber(
          snapshot
            ?.historicalAverageIncome
        ),

      historicalAverageExpense:
        safeNumber(
          snapshot
            ?.historicalAverageExpense
        ),

      historicalAverageNet:
        safeNumber(
          snapshot
            ?.historicalAverageNet
        ),

      savingsRate:
        snapshot
          ?.savingsRate ===
        null
          ? null
          : safeNumber(
              snapshot
                ?.savingsRate
            ),

      transactionCount:
        Math.max(
          0,
          Math.trunc(
            safeNumber(
              snapshot
                ?.transactionCount
            )
          )
        ),

      sampleSize:
        Math.max(
          0,
          Math.trunc(
            safeNumber(
              snapshot
                ?.sampleSize
            )
          )
        ),

      confidence:
        String(
          snapshot
            ?.confidence ||
            'low'
        ).slice(
          0,
          20
        ),

      projectedMonthExpense:
        safeNumber(
          snapshot
            ?.projectedMonthExpense
        ),

      projectedMonthNet:
        safeNumber(
          snapshot
            ?.projectedMonthNet
        ),

      receivablesOpen:
        safeNumber(
          snapshot
            ?.receivablesOpen
        ),

      receivablesOverdue:
        safeNumber(
          snapshot
            ?.receivablesOverdue
        ),

      overdueReceivablesCount:
        Math.max(
          0,
          Math.trunc(
            safeNumber(
              snapshot
                ?.overdueReceivablesCount
            )
          )
        ),

      recurringMonthlyEquivalent:
        safeNumber(
          snapshot
            ?.recurringMonthlyEquivalent
        ),

      topExpenseCategories:
        categories,

      activeBudgetCount:
        Math.max(
          0,
          Math.trunc(
            safeNumber(
              snapshot?.activeBudgetCount
            )
          )
        ),

      warningBudgetCount:
        Math.max(
          0,
          Math.trunc(
            safeNumber(
              snapshot?.warningBudgetCount
            )
          )
        ),

      overBudgetCount:
        Math.max(
          0,
          Math.trunc(
            safeNumber(
              snapshot?.overBudgetCount
            )
          )
        ),

      goalsActiveCount:
        Math.max(
          0,
          Math.trunc(
            safeNumber(
              snapshot?.goalsActiveCount
            )
          )
        ),

      goalsOverdueCount:
        Math.max(
          0,
          Math.trunc(
            safeNumber(
              snapshot?.goalsOverdueCount
            )
          )
        ),

      goalsNearDeadlineCount:
        Math.max(
          0,
          Math.trunc(
            safeNumber(
              snapshot?.goalsNearDeadlineCount
            )
          )
        ),

      creditCardOpenExposure:
        safeNumber(
          snapshot?.creditCardOpenExposure
        ),

      creditCardLimitTotal:
        safeNumber(
          snapshot?.creditCardLimitTotal
        ),

      creditCardUtilizationRate:
        safeNumber(
          snapshot?.creditCardUtilizationRate
        ),

      overdueCardInvoiceAmount:
        safeNumber(
          snapshot?.overdueCardInvoiceAmount
        ),

      overdueCardInvoiceCount:
        Math.max(
          0,
          Math.trunc(
            safeNumber(
              snapshot?.overdueCardInvoiceCount
            )
          )
        ),

      activeLoanRemaining:
        safeNumber(
          snapshot?.activeLoanRemaining
        ),

      overdueLoanCount:
        Math.max(
          0,
          Math.trunc(
            safeNumber(
              snapshot?.overdueLoanCount
            )
          )
        ),

      activeFinancingRemaining:
        safeNumber(
          snapshot?.activeFinancingRemaining
        ),

      overdueFinancingCount:
        Math.max(
          0,
          Math.trunc(
            safeNumber(
              snapshot?.overdueFinancingCount
            )
          )
        ),

      committedOutstandingTotal:
        safeNumber(
          snapshot?.committedOutstandingTotal
        ),
    },

    insights,
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const authorization =
      request.headers.get(
        'authorization'
      )

    const accessToken =
      authorization
        ?.startsWith(
          'Bearer '
        )
        ? authorization
            .slice(7)
            .trim()
        : ''

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            'Sessão não autenticada.',
        },
        {
          status: 401,
        }
      )
    }

    const supabase =
      getAuthClient()

    const {
      data: { user },
      error: authError,
    } =
      await supabase.auth
        .getUser(
          accessToken
        )

    if (
      authError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            'Sessão inválida ou expirada.',
        },
        {
          status: 401,
        }
      )
    }

    const apiKey =
      process.env
        .GEMINI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Gemini não configurado no servidor.',
        },
        {
          status: 503,
        }
      )
    }

    const body =
      await request.json()

    const messages =
      sanitizeMessages(
        body?.messages
      )

    if (
      messages.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'Mensagem obrigatória.',
        },
        {
          status: 400,
        }
      )
    }

    const financialContext =
      sanitizeFinancialContext(
        body?.financialContext
      )

    const snapshot =
      JSON.stringify(
        financialContext,
        null,
        2
      )

    const systemInstruction =
`Você é o assistente financeiro do DFL Finance.

Responda em português do Brasil, de forma natural, clara, prática e objetiva.

A verdade numérica vem exclusivamente do CONTEXTO FINANCEIRO ESTRUTURADO abaixo.

REGRAS:
- nunca invente saldo, receita, despesa, tendência, categoria, cobrança ou comparação;
- os insights já foram calculados deterministicamente pelo aplicativo;
- você pode explicar, relacionar e priorizar esses fatos, mas não deve substituir os cálculos;
- respeite confidence e sampleSize: quando a confiança for baixa, deixe a limitação clara;
- diferencie saldo atual de fluxo mensal;
- diferencie valores a receber de despesas;
- valores monetários estão em BRL;
- não diga que acessou banco, internet ou dados fora do contexto fornecido;
- quando não houver dados suficientes, diga isso claramente;
- prefira respostas curtas e úteis, normalmente em até 5 parágrafos curtos ou 6 itens;
- conclua a resposta dentro do limite disponível; não termine uma frase, item ou percentual pela metade;
- use Markdown simples quando ajudar: **negrito**, listas e pequenos títulos.

CONTEXTO FINANCEIRO ESTRUTURADO:
${snapshot}`

    const genAI =
      new GoogleGenerativeAI(
        apiKey
      )

    const model =
      genAI.getGenerativeModel({
        model:
          'gemini-3.6-flash',
        systemInstruction,
      })

    const contents =
      messages.map(
        (message) => ({
          role:
            message.role ===
            'assistant'
              ? 'model'
              : 'user',
          parts: [
            {
              text:
                message.content,
            },
          ],
        })
      )

    let startTimeout:
      ReturnType<typeof setTimeout> |
      undefined

    const result =
      await Promise.race([
        model.generateContentStream({
          contents,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens:
              1400,
          },
        }),
        new Promise<never>(
          (_, reject) => {
            startTimeout =
              setTimeout(
                () =>
                  reject(
                    assistantTimeoutError()
                  ),
                GEMINI_START_TIMEOUT_MS
              )
          }
        ),
      ]).finally(() => {
        if (startTimeout) {
          clearTimeout(
            startTimeout
          )
        }
      })

    const encoder =
      new TextEncoder()

    const stream =
      new ReadableStream({
        async start(
          controller
        ) {
          try {
            for await (
              const chunk
              of result.stream
            ) {
              const text =
                chunk.text()

              if (text) {
                controller.enqueue(
                  encoder.encode(
                    text
                  )
                )
              }
            }

            const response =
              await result.response

            const candidate =
              response
                ?.candidates?.[0]

            const finishReason =
              String(
                candidate
                  ?.finishReason ||
                  ''
              )

            const wasTruncated =
              finishReason ===
                'MAX_TOKENS' ||
              finishReason ===
                'OTHER'

            controller.enqueue(
              encoder.encode(
                `\n__DFL_ASSISTANT_META__${JSON.stringify({
                  finishReason,
                  wasTruncated,
                })}`
              )
            )

            controller.close()
          } catch (error: any) {
            console.error(
              'Erro durante streaming do assistente:',
              error
            )

            const message =
              String(
                error?.message ||
                  'O provedor interrompeu a resposta.'
              )
                .trim()
                .slice(0, 240)

            controller.enqueue(
              encoder.encode(
                `\n__DFL_ASSISTANT_META__${JSON.stringify({
                  finishReason:
                    'STREAM_ERROR',
                  wasTruncated: false,
                  error:
                    message ||
                    'O provedor interrompeu a resposta.',
                })}`
              )
            )

            controller.close()
          }
        },
      })

    return new Response(
      stream,
      {
        status: 200,
        headers: {
          'Content-Type':
            'text/plain; charset=utf-8',
          'Cache-Control':
            'no-cache, no-transform',
          'X-Accel-Buffering':
            'no',
        },
      }
    )
  } catch (error: any) {
    console.error(
      'Erro no assistente financeiro:',
      error
    )

    const isTimeout =
      String(
        error?.message || ''
      ).includes(
        'demorou mais que o esperado'
      )

    return NextResponse.json(
      {
        error:
          isTimeout
            ? 'O assistente demorou mais que o esperado. Tente novamente.'
            : error?.message ||
              'Erro ao consultar o assistente.',
      },
      {
        status:
          isTimeout
            ? 504
            : 500,
      }
    )
  }
}
