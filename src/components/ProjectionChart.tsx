// src/components/ProjectionChart.tsx
'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { format, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useProjection, ProjectionData } from '@/hooks/useProjection'
import { useContext_ } from '@/components/ContextToggle'
import { Loader2 } from 'lucide-react'

interface ProjectionChartProps {
  hideBalance?: boolean
  formatCurrency?: (val: number) => string
}

// Formatação de moeda padrão
const defaultFormatCurrency = (val: number) =>
  `R$ ${(val || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

// ✅ FUNÇÃO SEGURA PARA FORMATAR DATA
const safeFormatDate = (dateStr: string, pattern: string): string => {
  try {
    if (!dateStr) return ''
    const date = parseISO(dateStr)
    if (!isValid(date)) return ''
    return format(date, pattern, { locale: ptBR })
  } catch {
    return ''
  }
}

// ✅ FUNÇÃO SEGURA PARA FORMATAR DATA DO TOOLTIP
const safeFormatTooltipDate = (dateStr: string): string => {
  try {
    if (!dateStr) return ''
    const date = parseISO(dateStr)
    if (!isValid(date)) return ''
    return format(date, "dd 'de' MMM", { locale: ptBR })
  } catch {
    return dateStr || ''
  }
}

// Gradiente para o preenchimento da área
const GradientDef = () => (
  <defs>
    <linearGradient id="projectionGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
    </linearGradient>
    <linearGradient id="projectionGradientNegative" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
    </linearGradient>
  </defs>
)

// ✅ Custom Tooltip com tratamento seguro
const CustomTooltip = ({
  active,
  payload,
  label,
  formatCurrency,
  hideBalance,
}: {
  active?: boolean
  payload?: any[]
  label?: string
  formatCurrency: (val: number) => string
  hideBalance?: boolean
}) => {
  if (!active || !payload || !payload.length) return null

  const data = payload[0].payload
  if (!data) return null

  const dayLabel = safeFormatTooltipDate(label || '')

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-[16px] p-3 shadow-lg">
      <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500">{dayLabel || label}</p>
      <p className={`text-[16px] font-bold ${data.balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500 dark:text-red-400'}`}>
        {hideBalance ? '••••' : formatCurrency(data.balance)}
      </p>
    </div>
  )
}

export default function ProjectionChart({ hideBalance = false, formatCurrency = defaultFormatCurrency }: ProjectionChartProps) {
  const { effectiveContext } = useContext_()
  const projection = useProjection(effectiveContext as 'dfl' | 'personal')

  // Verifica se a projeção ficará negativa em algum ponto
  const hasNegativePoint = useMemo(() => {
    if (!projection?.dailyProjection) return false
    return projection.dailyProjection.some((p) => p.balance < 0)
  }, [projection])

  // ✅ Dados formatados para o gráfico com tratamento de data seguro
  const chartData = useMemo(() => {
    if (!projection?.dailyProjection) return []
    return projection.dailyProjection.map((p) => {
      const dayLabel = safeFormatDate(p.day, "dd/MM")
      return {
        ...p,
        dayLabel: dayLabel || p.day || '',
        isNegative: p.balance < 0,
      }
    })
  }, [projection])

  // Loading
  if (!projection) {
    return (
      <div className="h-[120px] w-full flex items-center justify-center bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700">
        <Loader2 size={24} className="animate-spin text-teal-500" />
      </div>
    )
  }

  // Se não houver dados suficientes
  if (chartData.length === 0) {
    return (
      <div className="h-[120px] w-full flex items-center justify-center bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700">
        <p className="text-[13px] font-medium text-gray-400 dark:text-gray-500">
          Dados insuficientes para projeção
        </p>
      </div>
    )
  }

  // Último valor para referência
  const lastValue = chartData[chartData.length - 1]?.balance || 0
  const strokeColor = hasNegativePoint ? '#ef4444' : '#3b82f6'
  const gradientId = hasNegativePoint ? 'projectionGradientNegative' : 'projectionGradient'

  // Encontrar os limites para o eixo Y
  const minValue = Math.min(...chartData.map((p) => p.balance), 0)
  const maxValue = Math.max(...chartData.map((p) => p.balance), 100)

  return (
    <div className="w-full bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-4 relative">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
            Projeção 30 dias
          </p>
          <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">
            {hideBalance ? '••••' : formatCurrency(lastValue)}
          </p>
        </div>

        {projection.dayZero && projection.dayZero <= 30 && (
          <div className="px-3 py-1 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold">
            ⚠️ Dia {projection.dayZero}
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <AreaChart
          data={chartData}
          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
        >
          <GradientDef />
          
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Eixos invisíveis (hidden) */}
          <XAxis
            dataKey="dayLabel"
            hide={true}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            hide={true}
            domain={[Math.min(minValue - 10, -10), Math.max(maxValue + 50, 50)]}
          />

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            strokeOpacity={0.2}
            vertical={false}
          />

          <Tooltip
            content={({ active, payload, label }) => (
              <CustomTooltip
                active={active}
                payload={payload}
                label={label}
                formatCurrency={formatCurrency}
                hideBalance={hideBalance}
              />
            )}
          />

          {/* Linha de referência no zero */}
          <ReferenceLine
            y={0}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            strokeOpacity={0.4}
          />

          <Area
            type="monotone"
            dataKey="balance"
            stroke={strokeColor}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            activeDot={{
              r: 4,
              fill: strokeColor,
              stroke: '#fff',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Recomendação */}
      {projection.recommendation && (
        <p className="mt-3 text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
          {projection.recommendation}
        </p>
      )}
    </div>
  )
}