// src/lib/financial-intelligence/selectors.ts

import type {
  FinancialInsight,
  FinancialIntelligenceOutput,
} from './types'

export function selectFinancialInsights(
  intelligence: FinancialIntelligenceOutput,
  options?: {
    limit?: number
  }
): FinancialInsight[] {
  const limit = Math.max(1, options?.limit || 3)
  return intelligence.insights.slice(0, limit)
}

export function buildFinancialSuggestedQuestions(
  intelligence: FinancialIntelligenceOutput,
  limit = 4
) {
  const questions: string[] = []

  for (const insight of intelligence.insights) {
    if (
      insight.suggestedQuestion &&
      !questions.includes(insight.suggestedQuestion)
    ) {
      questions.push(insight.suggestedQuestion)
    }
  }

  const fallback = [
    'Como está meu mês até agora?',
    'Onde estou gastando mais?',
    'Como meu mês se compara ao anterior?',
    'O que merece mais atenção agora?',
  ]

  for (const question of fallback) {
    if (questions.length >= limit) break

    if (!questions.includes(question)) {
      questions.push(question)
    }
  }

  return questions.slice(0, limit)
}
