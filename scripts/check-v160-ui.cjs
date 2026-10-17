const fs=require('fs');
const p=(f)=>fs.readFileSync(f,'utf8');
const components={
  toast:p('src/components/Toast.tsx'),
  confirm:p('src/components/ui/ConfirmDialog.tsx'),
  select:p('src/components/SelectField.tsx'),
  bank:p('src/components/BankPickerField.tsx'),
  date:p('src/components/DatePickerSheet.tsx'),
  receipt:p('src/components/ReceiptModal.tsx'),
  profile:p('src/components/ProfileEditModal.tsx'),
  css:p('src/app/globals.css'),
  haptic:p('src/hooks/useHapticFeedback.ts'),
};
const checks=[
 ['Toast com notificacao acessivel',/role=\{urgent \? 'alert' : 'status'\}/.test(components.toast)],
 ['Toast controla timers',components.toast.includes('clearTimeout')],
 ['Confirmacao preserva busy',components.confirm.includes('disabled={busy}')],
 ['Confirmacao identifica alertdialog',components.confirm.includes('role="alertdialog"')],
 ['Seletor tem dialog modal',components.select.includes('aria-modal="true"')],
 ['Seletor devolve foco',/\.focus\(\)/.test(components.select)],
 ['Banco tem busca e normalizacao',components.bank.includes('searchBankRegistry')&&components.bank.includes('canonicalizeBankName')],
 ['Banco devolve foco',components.bank.includes('const triggerAtOpen = triggerRef.current') && components.bank.includes('triggerAtOpen.focus()')],
 ['Calendario usa data local',components.date.includes('toLocalISO')&&components.date.includes('parseLocalDate')],
 ['Calendario tem rotulo de dia',components.date.includes('aria-label={new Intl.DateTimeFormat')],
 ['Comprovante preserva canais imagem e PDF',components.receipt.includes('accept="image/*"')&&components.receipt.includes('accept="application/pdf,.pdf"')],
 ['Comprovante tem modal acessivel',components.receipt.includes('aria-modal="true"')],
 ['Perfil trata erro de gravacao',components.profile.includes('if (error)')],
 ['Campos globais tem foco visual',components.css.includes('.app-field')&&components.css.includes('focus-visible')],
 ['Haptico tem fallback seguro',components.haptic.includes('navigator.vibrate')],
];
let failed=0;
for(const [name,pass] of checks){console.log(`${pass?'OK ':'ERR'} ${name}`);if(!pass)failed++;}
console.log(`${checks.length-failed}/${checks.length} contratos de UI`);
if(failed)process.exitCode=1;
