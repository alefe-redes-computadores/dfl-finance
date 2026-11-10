/** R464: gera o plugin no projeto Android efêmero do CI, após SystemBars V15. */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const main = 'android/app/src/main/java/com/dflfinance/app/MainActivity.java'
const manifest = 'android/app/src/main/AndroidManifest.xml'
const srcRoot = path.dirname(main)
const resource = 'android/app/src/main/res/xml/dfl_apk_paths.xml'
if (!fs.existsSync(main) || !fs.existsSync(manifest)) throw new Error('Android gerado não encontrado.')
const read = file => fs.readFileSync(file, 'utf8')
let source = read(main)
if (!source.includes('registerPlugin(SystemBarsPlugin.class);') || !source.includes('DFL_FINANCE_SYSTEM_BARS_V29_VAULT_DONOR'))
  throw new Error('Aplicar R464 somente após o patch de barras V15.')
const pkg = source.match(/package\s+([\w.]+)\s*;/)?.[1]
if (pkg !== 'com.dflfinance.app') throw new Error('Pacote Android inesperado.')
if (!source.includes('registerPlugin(DflApkUpdaterPlugin.class);')) {
  const target = 'registerPlugin(SystemBarsPlugin.class);'
  if (source.split(target).length !== 2) throw new Error('Registro SystemBars divergente.')
  source = source.replace(target, 'registerPlugin(DflApkUpdaterPlugin.class);\n    ' + target)
  fs.writeFileSync(main, source)
}
for (const file of ['DflApkUpdaterPlugin.java','DflApkFileProvider.java']) {
  const template = read(`native/r464/${file}`)
  if (!template.includes('package __PACKAGE__;')) throw new Error('Template nativo sem placeholder.')
  const output = path.join(srcRoot, file)
  fs.writeFileSync(output, template.replace('package __PACKAGE__;', `package ${pkg};`))
}
fs.mkdirSync(path.dirname(resource), { recursive: true })
fs.copyFileSync('native/r464/dfl_apk_paths.xml', resource)
const python = String.raw`
from pathlib import Path
import xml.etree.ElementTree as ET
p = Path('android/app/src/main/AndroidManifest.xml')
ns = 'http://schemas.android.com/apk/res/android'
ET.register_namespace('android', ns)
tree = ET.parse(p); root = tree.getroot()
a = '{'+ns+'}'
if root.tag != 'manifest': raise SystemExit('Manifest invalido')
for child in list(root):
    if child.tag == 'uses-permission' and child.get(a+'name') == 'android.permission.REQUEST_INSTALL_PACKAGES':
        break
else:
    perm = ET.Element('uses-permission')
    perm.set(a+'name', 'android.permission.REQUEST_INSTALL_PACKAGES')
    root.insert(0, perm)
app = root.find('application')
if app is None: raise SystemExit('application ausente')
providers = [x for x in app.findall('provider') if x.get(a+'authorities') == '$' + '{applicationId}.dflapkprovider']
if len(providers) > 1: raise SystemExit('FileProvider duplicado')
if not providers:
    provider = ET.SubElement(app, 'provider')
    provider.set(a+'name', 'com.dflfinance.app.DflApkFileProvider')
    provider.set(a+'authorities', '$' + '{applicationId}.dflapkprovider')
    provider.set(a+'exported', 'false')
    provider.set(a+'grantUriPermissions', 'true')
    meta = ET.SubElement(provider, 'meta-data')
    meta.set(a+'name', 'android.support.FILE_PROVIDER_PATHS')
    meta.set(a+'resource', '@xml/dfl_apk_paths')
else:
    raise SystemExit('FileProvider preexistente, inspecionar')
tree.write(p, encoding='utf-8', xml_declaration=True)
`;
const result = spawnSync('python3', ['-c', python], { stdio: 'inherit' })
if (result.status !== 0) throw new Error('Falha ao registrar FileProvider no AndroidManifest.')
for (const candidate of [main,manifest,resource,path.join(srcRoot,'DflApkUpdaterPlugin.java'),path.join(srcRoot,'DflApkFileProvider.java')]) {
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).size) throw new Error(`Arquivo Android ausente: ${candidate}`)
}
console.log('R464_NATIVE_PLUGIN_APLICADO: Activity, FileProvider privado, permissão explícita e bridge Capacitor.')
