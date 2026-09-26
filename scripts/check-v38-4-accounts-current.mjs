import fs from 'node:fs'
const r=f=>fs.readFileSync(f,'utf8'), ok=(v,m)=>{if(!v)throw new Error(`V38.4: ${m}`)}
const m=r('src/components/MoneyInput.tsx'),s=r('src/components/SelectField.tsx'),d=r('src/app/(app)/accounts/details/page.tsx'),f=r('src/app/(app)/accounts/new/page.tsx'),p=r('src/lib/accountPresentation.ts')
ok(m.includes("inputMode={allowNegative ? 'text' : 'numeric'}"),'teclado negativo')
ok(s.includes('icon?: ReactNode')&&s.includes('createPortal(')&&s.includes('z-[1000]'),'SelectField')
ok(
  (
    d.includes('value={adjustAmount}') &&
    d.includes('setAdjustAmount(value)')
  ) || (
    d.includes("adjustMode === 'decrease'") &&
    d.includes('Math.abs(adjustAmount)') &&
    d.includes('MoneyInput')
  ),
  'ajuste monetário'
)
ok(d.includes('value={transferAmount}')&&d.includes('setTransferAmount(value)'),'transferência monetária')
for(const t of ['checking','savings','digital','wallet','investment','other'])ok(f.includes(`value: "${t}"`),`tipo ${t}`)
ok(!f.includes('value: "credit_card"'),'credit_card ainda criável')
ok(f.includes('icon: <TypeIcon'),'ícones')
ok(p.includes("digital: 'Conta Digital'"),'label digital')
ok(p.includes("credit_card: 'Cartão de Crédito'"),'legado credit_card')
console.log('DFL FINANCE V38.4 ACCOUNTS CURRENT: OK')
