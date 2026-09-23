import fs from 'node:fs'

const r=(f)=>fs.readFileSync(f,'utf8')
const ok=(v,m)=>{ if(!v) throw new Error(`V30: ${m}`) }

const cfg=r('capacitor.config.ts')
const n=r('src/lib/nativeNotifications.ts')
const prep=r('scripts/prepare-android-notification-icon.mjs')
const wf=r('.github/workflows/android-build.yml')
const xml=r('assets/android/ic_stat_dfl_finance.xml')
const more=r('src/app/(app)/more/page.tsx')

ok(cfg.includes("smallIcon: 'ic_stat_dfl_finance'"),'config smallIcon incorreta')
ok(xml.includes('<vector'),'asset não é VectorDrawable')
ok(xml.includes('android:fillColor="#FFFFFFFF"'),'asset não é máscara monocromática branca')
ok(!xml.includes('<bitmap'),'asset contém bitmap')
ok(prep.includes("assets/android/ic_stat_dfl_finance.xml"),'prepare não usa XML dedicado')
ok(prep.includes("ic_stat_dfl_finance.xml"),'destino XML ausente')
ok(prep.includes('fs.rmSync(legacy)'), 'PNG legado não é removido')

const sync=wf.lastIndexOf('npx cap sync android')
const prepStep=wf.indexOf('npm run native:notifications:assets')
ok(sync>=0 && prepStep>sync,'small icon não é restaurado após o último cap sync')

ok(n.includes('requestNativeNotificationPermission'),'request explícito V29 ausente')
ok(n.includes('LocalNotifications.checkPermissions()'),'checkPermissions ausente')
ok(n.includes('LocalNotifications.requestPermissions()'),'requestPermissions ausente')
ok(n.includes('LocalNotifications.createChannel'),'canal Android ausente')
ok(n.includes('channelId:'),'scheduler não referencia canal')
ok(n.includes('category:'),'metadata category ausente')
ok(n.includes('managedBy:'),'ownership metadata ausente')
ok(n.includes('route:'),'deep-link metadata ausente')
ok(n.includes('getPending()'),'reconciliação pending ausente')
ok(n.includes('LocalNotifications.cancel'),'cancelamento ausente')

ok(more.includes('requestNativeNotificationPermission()'),'UI não solicita permissão explicitamente')
ok(more.includes('Enviar notificação de teste'),'teste explícito ausente')

// Proíbe introduzir ensure de canal no boot/managers.
for(const f of [
  'src/components/NativeNotificationManager.tsx',
  'src/components/PushNotificationManager.tsx'
]){
  if(!fs.existsSync(f)) continue
  const x=r(f)
  ok(!/ensureChannel\s*\(|ensureNotificationChannel\s*\(/.test(x),
     `canal não deve ser garantido incondicionalmente em ${f}`)
}

console.log('V30 NOTIFICATIONS VAULT CONTRACT: OK')
