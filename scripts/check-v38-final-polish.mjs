import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const ok = (value, message) => {
  if (!value) throw new Error(`V38.2: ${message}`)
}

const select = read('src/components/SelectField.tsx')
const empty = read('src/components/EmptyState.tsx')
const reports = read('src/app/(app)/reports/page.tsx')
const analysis = read('src/app/(app)/analysis/page.tsx')
const financing = read('src/app/(app)/financings/new/page.tsx')
const modal = read('src/components/ModalFinancing.tsx')
const css = read('src/app/globals.css')
const money = read('src/components/MoneyInput.tsx')
const native = read('src/lib/nativeNotifications.ts')

ok(select.includes("createPortal"), 'SelectField sem portal')
ok(select.includes("document.body.style.overflow = 'hidden'"), 'SelectField sem scroll lock')
ok(select.includes("event.key === 'Escape'"), 'SelectField sem Escape')
ok(select.includes('Nenhuma opção disponível'), 'SelectField sem empty state')
ok(select.includes('aria-labelledby={titleId}'), 'SelectField sem título acessível')
ok(select.includes('z-[1000]'), 'SelectField sem camada global')

ok(empty.includes('role="status"'), 'EmptyState sem semântica')
ok(empty.includes('type="button"'), 'EmptyState action sem type button')

ok(reports.includes("onExport: (format: 'csv') => void;"), 'Relatórios ainda aceita PDF')
ok(!reports.includes("format === 'pdf'"), 'branch PDF ainda existe em Relatórios')
ok(!reports.includes('A exportação em PDF estará disponível em breve'), 'copy PDF morta em Relatórios')

ok(analysis.includes("format: 'csv') => {"), 'Análise não foi estreitada para CSV')
ok(!analysis.includes("handleExport(opt.key, 'pdf')"), 'menu PDF ainda existe em Análise')
ok(!analysis.includes("key={`pdf-${opt.key}`}"), 'bloco PDF ainda existe em Análise')
ok(!analysis.includes('FileText'), 'import PDF órfão em Análise')
ok(!analysis.includes('A exportação em PDF estará disponível em breve'), 'copy PDF morta em Análise')

ok(financing.includes("setInstallmentsCount(e.target.value.replace(/\\D/g, '').slice(0, 3))"), 'parcelas novas sem sanitização')
ok(modal.includes("setTotalInstallments(e.target.value.replace(/\\D/g, '').slice(0, 3))"), 'parcelas modal sem sanitização')
ok(css.includes('DFL_FINANCE_V38_REDUCED_MOTION'), 'reduced-motion ausente')

ok(money.includes('allowNegative?: boolean'), 'MoneyInput V37 regrediu')
ok(native.includes("key: `goal:${goal.id}`"), 'metas V37 regrediram')
ok(native.includes("route: `/subscriptions/details?id=${subscription.id}`"), 'assinaturas V37 regrediram')

console.log('DFL FINANCE V38.2 FINAL POLISH: OK')
