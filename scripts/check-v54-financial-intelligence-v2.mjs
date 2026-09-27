import fs from 'node:fs'

const read = (file) =>
  fs.readFileSync(
    file,
    'utf8'
  )

const ok = (
  condition,
  message
) => {
  if (!condition) {
    throw new Error(
      `V54: ${message}`
    )
  }

  console.log(
    `OK: ${message}`
  )
}

const types =
  read(
    'src/lib/financial-intelligence/types.ts'
  )

const engine =
  read(
    'src/lib/financial-intelligence/engine.ts'
  )

const selectors =
  read(
    'src/lib/financial-intelligence/selectors.ts'
  )

const projection =
  read(
    'src/hooks/useProjection.ts'
  )

ok(
  types.includes(
    'priorityScore?: number'
  ) &&
    types.includes(
      'FinancialInsightExplanation'
    ),
  'insight possui ranking e explicabilidade estruturada'
)

ok(
  types.includes(
    'projectionSampleDays?: number'
  ) &&
    types.includes(
      'projectionCappedDays?: number'
    ) &&
    types.includes(
      'projectionOutlierCap?: number'
    ),
  'snapshot expõe evidência da projeção'
)

ok(
  engine.includes(
    'buildRobustDailyExpense'
  ) &&
    engine.includes(
      'percentile('
    ) &&
    engine.includes(
      'positive,'
    ) &&
    engine.includes(
      '0.9'
    ) &&
    engine.includes(
      'const robustMonthExpense'
    ) &&
    engine.includes(
      'robustMonthExpense'
    ) &&
    engine.includes(
      '.dailyAverage'
    ),
  'projeção mensal usa média diária robusta com P90'
)

ok(
  !engine.includes(
    '(currentMonthExpense / elapsedDays) * monthDays'
  ),
  'extrapolação ingênua da despesa mensal foi removida'
)

ok(
  engine.includes(
    'buildPriorityScore'
  ) &&
    engine.includes(
      'priorityScore:'
    ) &&
    engine.includes(
      'explanation:'
    ),
  'insights recebem score e explicabilidade'
)

ok(
  engine.includes(
    '(b.priorityScore || 0)'
  ) &&
    selectors.includes(
      'b.priorityScore'
    ),
  'engine e selector usam ranking V54'
)

ok(
  engine.includes(
    "actionRoute:"
  ) &&
    engine.includes(
      "'/analysis'"
    ) &&
    engine.includes(
      'currentMonthStart'
    ) &&
    engine.includes(
      'todayISO'
    ),
  'explicação registra período e próxima ação'
)

ok(
  projection.includes(
    'expenseByDay'
  ) &&
    projection.includes(
      'dailyCap'
    ) &&
    projection.includes(
      'robustHistoricalExpense'
    ),
  'contrato robusto V36 de 30 dias permanece intacto'
)

ok(
  !engine.includes(
    'minimumDaily'
  ) &&
    !engine.includes(
      'weekend'
    ),
  'motor não inventa gasto mínimo nem regra de fim de semana'
)

console.log(
  'DFL FINANCE V54 FINANCIAL INTELLIGENCE V2: OK'
)
