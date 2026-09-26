import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')

const ok = (value, message) => {
  if (!value) throw new Error(`V49.3: ${message}`)
}

const css = read('src/app/globals.css')
const money = read('src/components/MoneyInput.tsx')
const select = read('src/components/SelectField.tsx')
const bank = read('src/components/BankPickerField.tsx')
const financing = read('src/app/(app)/financings/new/page.tsx')
const modal = read('src/components/ModalFinancing.tsx')

ok(
  css.includes('DFL_FORM_POLISH_V49'),
  'CSS final ausente'
)

ok(
  money.includes('selectOnFocus?: boolean'),
  'MoneyInput selectOnFocus ausente'
)

ok(
  money.includes("inputMode={allowNegative ? 'text' : 'numeric'}"),
  'contrato MoneyInput regrediu'
)

ok(
  select.includes('createPortal') &&
  select.includes('z-[1000]') &&
  select.includes('focus-visible:ring-2'),
  'SelectField final incompleto'
)

ok(
  bank.includes('Usar instituição personalizada') &&
  bank.includes('createPortal'),
  'BankPicker final incompleto'
)

ok(
  !financing.includes('type="number"'),
  'financings/new ainda possui number'
)

ok(
  !modal.includes('type="number"'),
  'ModalFinancing ainda possui number'
)

for (const [name, source] of [
  ['financings/new', financing],
  ['ModalFinancing', modal],
]) {
  const inputs =
    source.match(/<input\b[\s\S]*?\/>/g) || []

  for (const input of inputs) {
    ok(
      (input.match(/\binputMode\s*=/g) || []).length <= 1,
      `${name}: inputMode duplicado`
    )

    ok(
      (input.match(/\btype\s*=/g) || []).length <= 1,
      `${name}: type duplicado`
    )
  }
}

console.log(
  'DFL FINANCE V49.3 FINAL FORM POLISH: OK'
)
