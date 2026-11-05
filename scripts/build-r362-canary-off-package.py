#!/usr/bin/env python3
"""R362: montagem de bundle OFF, sem cliente Supabase ou requests de rede."""
import hashlib
import json
import pathlib
import re
import sys
import zipfile
from datetime import datetime

ROOT = pathlib.Path.home() / 'projects/dfl-finance'
R359 = pathlib.Path.home() / 'storage/downloads/DFL-FINANCE-R359-CANARIO-OFF-20261027-173507-31370.zip'
EXPECTED_R359 = '9840d1f91c19e13577e91fb32632d73bcff77d0a4a050ea5adb6b3a325e6ff0d'
EXPECTED_FILES = (
    'whatsapp-webhook/index.ts',
    '_shared/atomicBotSingle.ts',
    '_shared/atomicBotSingleV2.ts',
    '_shared/atomicBotV2Bridge.ts',
    '_shared/atomicV2Integration.ts',
    '_shared/atomicV2Orchestrator.ts',
    '_shared/atomicV2Session.ts',
    '_shared/atomicV2Stage.ts',
    '_shared/atomicV2WebhookHandoff.ts',
    '_shared/financeComparisons.ts',
    '_shared/financePace.ts',
    '_shared/financePlanning.ts',
    '_shared/requestSecurity.ts',
)
OFF = 'const v2Requested=false;'
SQL_OFF = 'const r361CanarySqlVisibility=false;'

def die(message):
    raise SystemExit('R362 BLOQUEADA: ' + message)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def resolve_relative(origin, imported):
    components = origin.split('/')[:-1]
    for part in imported.split('/'):
        if part == '.':
            continue
        if part == '..':
            if not components:
                die('Import fora da pasta da função')
            components.pop()
        else:
            components.append(part)
    return '/'.join(components)

if not R359.is_file() or digest(R359.read_bytes()) != EXPECTED_R359:
    die('Pacote R359 ausente ou com SHA alterado')
source = ROOT / 'supabase/functions/whatsapp-webhook/index.r362-canary-off.ts'
if not source.is_file():
    die('Candidata R362 não instalada')
code = source.read_text(encoding='utf-8')
if code.count(OFF) != 1 or code.count(SQL_OFF) != 1:
    die('V2 ou proteção SQL não estão forçadamente OFF')
if 'const v2Mode=v2Requested && canaryDecision' not in code:
    die('Decisor V2 desconectado')
if 'r362.canary.consumed_session_restricted' not in code:
    die('Trava da sessão consumida ausente')
if code.count('r357CanaryDecision(') != 2:
    die('Decisor não está declarado e invocado exatamente uma vez')
if 'const atomicMode=false;' not in code:
    die('V1 não foi travada')

with zipfile.ZipFile(R359) as z:
    zfiles = set(z.namelist())
    if not set(EXPECTED_FILES).issubset(zfiles):
        die('Faltam dependências na R359')
    bundle = {name: z.read(name) for name in EXPECTED_FILES}
    baseline = bundle['whatsapp-webhook/index.ts']
    if b'const v2Requested=false;' not in baseline:
        die('Fonte da R359 não está OFF')
    bundle['whatsapp-webhook/index.ts'] = code.encode('utf-8')

# Fechamento do grafo de importação relativo e tipos estáticos.
missing = []
for fname, content in bundle.items():
    text = content.decode('utf-8')
    for match in re.finditer(r'\b(?:from|import)\s*[\(]?\s*[\'\"]([^\'\"]+)[\'\"]', text):
        target = match.group(1)
        if target.startswith('.'):
            absolute = resolve_relative(fname, target)
            if absolute not in bundle:
                missing.append(f'{fname}: {target} => {absolute}')
if missing:
    die('Grafo incompleto: '+', '.join(missing))

# Metadata e SHA bytes, não confundir com assinatura criptográfica.
manifest = {
    'release': 'R362',
    'mode': 'CANARY_PREDEPLOY_HARD_OFF',
    'source_commit': 'd61605df99700571d94733a6983855e4a33f2f82',
    'baseline_supabase_webhook': {'version': 161, 'ezbr_sha256': 'cd6c2da10742a63b2a9d570a5d3131b5745bc1a5e401da41f4e2cbd59fd0d2d8'},
    'verify_jwt': False,
    'v2_requested': False,
    'r361_sql_visibility': False,
    'sql_applied_by_script': False,
    'files': [{'name': name, 'bytes': len(bundle[name]), 'sha256': digest(bundle[name])} for name in EXPECTED_FILES],
    'rollback_to': 'whatsapp-webhook version 161 (confirm remote immediately before any future deploy)',
}
readme = '''DFL Finance R362 | bundle Edge Function com V2 HARD-OFF.
O ZIP é um artefato de PREPARAÇÃO, NÃO FOI implantado automaticamente.
Exige nova auditoria remota de V161 antes de qualquer deploy.
Não publique a V2 ON: R362 não aplica a SQL candidata.
Mantenha verify_jwt=false como a V161 já usa, SOMENTE no futuro deploy homologado.
Não usar variáveis de ambiente para contornar OFF; requer novo deploy autorizado.
'''
downloads = pathlib.Path.home() / 'storage/downloads'
dest = downloads / ('DFL-FINANCE-R362-CANARIO-HARD-OFF-' + datetime.now().strftime('%Y%m%d-%H%M%S') + '.zip')
if dest.exists():
    die('Arquivo de saída já existe; nada foi sobrescrito')
with zipfile.ZipFile(dest, 'x', compression=zipfile.ZIP_DEFLATED) as result:
    for name in EXPECTED_FILES:
        result.writestr(name, bundle[name])
    result.writestr('MANIFEST.json', json.dumps(manifest, indent=2, ensure_ascii=False)+'\n')
    result.writestr('README.txt', readme)
with zipfile.ZipFile(dest) as result:
    if result.testzip() is not None:
        die('ZIP criado com erro CRC')
    for item in manifest['files']:
        if digest(result.read(item['name'])) != item['sha256']:
            die('Falha SHA no ZIP: ' + item['name'])
print('=== R362 BUNDLE OFF GERADO E VALIDADO ===')
print('Arquivos Edge:', len(bundle))
print('V2 ativada: NÃO')
print('Caminho:', dest)
print('SHA256:', digest(dest.read_bytes()))
print('Banco, webhook remoto, variáveis e repositório Git NÃO alterados pelo empacotador.')
