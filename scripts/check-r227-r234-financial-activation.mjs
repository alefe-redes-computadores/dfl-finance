import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const s=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8');
const at=s.indexOf('/* R227_R234_UNSAFE_MODE_GUARD');
const end=s.indexOf('const r=atomicMode',at);
assert.ok(at>0&&end>at,'bloco de seguranca identificado');
const block=s.slice(at,end);
assert.ok(block.includes('DFL_ATOMIC_V1_UNSAFE_DISABLED'));
assert.ok(block.includes('DFL_ATOMIC_V2_NOT_RELEASED'));
assert.ok(block.includes('const atomicMode=false;'));
assert.ok(!block.includes('db.rpc('),'bloqueio sem escrita financeira');
for(const [v1,v2,shouldThrow] of [['enabled',undefined,'DFL_ATOMIC_V1_UNSAFE_DISABLED'],[undefined,'true','DFL_ATOMIC_V2_NOT_RELEASED'],[undefined,undefined,null],['disabled','false',null]]){
 const vars={DFL_BOT_ATOMIC_SINGLE_V1:v1,DFL_BOT_ATOMIC_V2_ENABLED:v2};
 const context={Deno:{env:{get:k=>vars[k]}},Error};
 let got=null;
 try{vm.runInNewContext(block+'\n;globalThis.__atomicMode=atomicMode;',context,{timeout:1000})}catch(e){got=String(e.message)}
 assert.equal(got,shouldThrow,`v1=${v1} v2=${v2}`);
 if(!got)assert.equal(context.__atomicMode,false);
 console.log('OK: flags V1/V2',v1||'ausente',v2||'ausente',shouldThrow||'legado');
}
for(const [name,source] of [['webhook',s],['V2 helper',fs.readFileSync('supabase/functions/_shared/atomicBotSingleV2.ts','utf8')]]){
 const ast=ts.createSourceFile(name+'.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 assert.equal(ast.parseDiagnostics.length,0,`TypeScript parse ${name}`);
}
assert.ok(s.includes('p_idempotency_key:key'),'idempotencia legado preservada');
assert.ok(s.includes('atomicBotFinalize(db,phone,txid'),'finalizacao legado preservada');
console.log('R227-R234: BLOQUEIO FUNCIONAL/CONTRATOS APROVADOS; V2 CONTINUA PENDENTE');
