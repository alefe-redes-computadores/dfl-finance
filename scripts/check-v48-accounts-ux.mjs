import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const ok = (value, message) => {
  if (!value) throw new Error(`V48: ${message}`)
}

const details = read('src/app/(app)/accounts/details/page.tsx')
const form = read('src/app/(app)/accounts/new/page.tsx')
const picker = read('src/components/BankPickerField.tsx')

ok(details.includes("adjustMode, setAdjustMode"), 'modo explícito de ajuste ausente')
ok(details.includes("adjustMode === 'decrease' ? -absoluteAmount : absoluteAmount"), 'ajuste negativo não assinado')
ok(details.includes('adjustedBalancePreview'), 'preview de saldo ausente')
ok(details.includes('O saldo ficará negativo. O ajuste será permitido normalmente.'), 'saldo negativo sem feedback')
ok(!/value=\{adjustAmount\}[\s\S]{0,180}?allowNegative/.test(details), 'ajuste ainda depende de digitar sinal negativo')
ok(details.includes("setAdjustMode('increase')") && details.includes("setAdjustMode('decrease')"), 'seletor adicionar/reduzir incompleto')

ok(form.includes("import BankPickerField from '@/components/BankPickerField'"), 'BankPickerField não importado')
ok(form.includes('<BankPickerField'), 'BankPickerField não usado')
ok(!form.includes('list="account-bank-options"'), 'datalist nativo ainda presente')
ok(!form.includes('<datalist id="account-bank-options">'), 'datalist nativo ainda presente')

ok(picker.includes('createPortal('), 'picker não usa portal')
ok(picker.includes('Buscar ou digitar outra instituição'), 'busca/custom ausente')
ok(picker.includes('Usar instituição personalizada'), 'cadastro de banco custom ausente')
ok(picker.includes('COMMON_BANKS'), 'lista de bancos ausente')
ok(picker.includes('BankLogo'), 'logos de banco ausentes')

console.log('DFL FINANCE V48 ACCOUNTS UX: OK')
