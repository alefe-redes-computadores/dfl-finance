import fs from 'node:fs'
import assert from 'node:assert/strict'
const source = fs.readFileSync('src/components/BottomNav.tsx', 'utf8')
const workflow = fs.readFileSync('.github/workflows/android-build.yml', 'utf8')
const check = (label, valid) => { assert.ok(valid, label); console.log('✓', label) }
check('O + principal sempre abre Nova Transação completa', /const handleCentralAction = \(\) => \{[\s\S]*?navigateSafely\('\/transactions\/new'\)/.test(source))
check('Ação rápida limitada à Home', source.includes('{isHome && (\n        <FAB'))
check('Botão Atalhos existe só na Home', source.includes('aria-label="Abrir atalhos da Home"') && source.includes('      {isHome && ('))
check('Receita pelo menu abre formulário completo', source.includes("navigateSafely('/transactions/new?type=income')"))
check('Despesa pelo menu abre formulário completo', source.includes("navigateSafely('/transactions/new?type=expense')"))
check('Rápido existe somente como opção explícita', source.includes('aria-label="Lançamento rápido opcional"'))
check('Cartão, Busca e Transferências foram preservados', source.includes("navigateSafely('/transactions/card-expense')") && source.includes("handleNavigate('/search')") && source.includes('setIsTransferModalOpen(true)'))
check('Menu não permanece aberto após navegação', source.includes('setQuickActionOpen(false)\n  }, [pathname])'))
check('Botão central acessível', source.includes('aria-label="Nova transação completa"'))
check('Exceção legada Transações removida', !source.includes('isTransactionsRoot'))
check('Workflow Android impede regressões', workflow.includes('node scripts/check-v167-full-entry.mjs'))
console.log('V167: 11 contratos de navegação aprovados')
