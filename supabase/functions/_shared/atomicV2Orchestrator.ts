/* R250–R258: pré-orquestração sem ativação no webhook.
 * STAGE é mutação da sessão, não autorização financeira.
 * COMMIT financeiro é uma ÚNICA RPC V2 que deve registrar e consumir atomicamente.
 * Nunca faz fallback para bot_record_transaction. */
import { stageAtomicV2Snapshot } from './atomicV2Stage.ts';
import { atomicBotSingleV2 } from './atomicBotSingleV2.ts';
import { restoredConsumedSession } from './atomicV2Session.ts';

type Client={from:(table:string)=>any;rpc:(name:string,args:Record<string,unknown>)=>Promise<any>};
type Input={db:Client;u:any;phone:string;sd:any;acc:any;cat:any;params:any};
function fail(code:string):never{throw new Error('DFL_V2_ORCH_'+code)}
async function sessionRow(db:Client,phone:string){
 const row=await db.from('bot_sessions').select('phone,step,revision,temp_data').eq('phone',phone).maybeSingle();
 if(row.error)throw row.error;
 if(!row.data)fail('MISSING_SESSION');
 return {...row.data,phone};
}
export async function prepareAtomicV2Session(input:Input){
 const {db,phone,u,sd,acc,cat,params}=input;
 if(!phone || !u?.user_id || !sd?.provider_message_id)fail('IDENTITY');
 const current=await sessionRow(db,phone);
 if(current.temp_data?.consumed_at || current.temp_data?.transaction_id)fail('ALREADY_CONSUMED');
 return stageAtomicV2Snapshot(db,u,phone,sd,acc,cat,params,current);
}
export async function commitPreparedAtomicV2(input:Input){
 const {db,phone,u,sd,acc,cat,params}=input;
 if(!phone || !u?.user_id || !sd?.provider_message_id)fail('IDENTITY');
 const current=await sessionRow(db,phone);
 if(current.step==='TX_SETTLE' && current.temp_data?.consumed_at){
  // A recuperação exige identidade de operação comprovada pela RPC/ledger.
  // Não usar somente presença do transaction_id para responder sucesso.
  fail('RECOVERY_REQUIRES_LEDGER_PROOF');
 }
 if(!current.temp_data?.atomic_snapshot)fail('NOT_PREPARED');
 // A validação completa do snapshot ocorre novamente na RPC em transação.
 // Esta chamada NÃO pode ser precedida por outra autorização consumível.
 return atomicBotSingleV2(db,u,phone,sd,acc,cat,params);
}
/* R259_LEDGER_PROOF: a sessao consumida nao e prova de operacao financeira.
 * Apenas consulta de uma transacao do proprio usuario e de mesmos campos
 * autoriza apresentar a operacao como recuperada. Sem efeitos no ledger. */
export async function verifyAtomicV2Recovery(input:Input){
 const {db,phone,u,sd,acc,cat,params}=input;
 if(!phone || !u?.user_id || !params?.p_idempotency_key)fail('RECOVERY_IDENTITY');
 const current=await sessionRow(db,phone);
 const result=restoredConsumedSession(current,{transaction_id:current.temp_data?.transaction_id});
 const key=String(params.p_idempotency_key);
 const expected='tx:'+key;
 if(current.step!=='TX_SETTLE' || current.temp_data?.proposal_id!==expected ||
    String(current.temp_data?.user_id)!==String(u.user_id) ||
    String(current.temp_data?.idempotency_key)!==key ||
    String(current.temp_data?.account_id)!==String(acc?.id) ||
    String(current.temp_data?.category_id??'')!==String(cat?.id??'') ||
    String(current.temp_data?.type)!==String(sd?.type) ||
    Number(current.temp_data?.amount)!==Number(sd?.amount) ||
    String(current.temp_data?.description)!==String(sd?.description) ||
    String(current.temp_data?.context)!==String(sd?.context) ||
    String(current.temp_data?.date)!==String(params?.p_date))fail('RECOVERY_SNAPSHOT_MISMATCH');
 const found=await db.from('transactions').select('id,user_id,account_id,category_id,type,amount,description,context,date,idempotency_key,status,affects_balance')
   .eq('id',result.transaction_id).eq('user_id',u.user_id).eq('idempotency_key',key).maybeSingle();
 if(found.error)throw found.error;
 const tx=found.data;
 if(!tx || String(tx.id)!==String(result.transaction_id) ||
    String(tx.user_id)!==String(u.user_id) ||
    String(tx.idempotency_key)!==key ||
    String(tx.account_id)!==String(acc?.id) ||
    String(tx.category_id??'')!==String(cat?.id??'') ||
    String(tx.type)!==String(sd?.type) ||
    Number(tx.amount)!==Number(sd?.amount) ||
    String(tx.description)!==String(sd?.description) ||
    String(tx.context)!==String(sd?.context) ||
    String(tx.date)!==String(params.p_date) ||
    !['pending','done'].includes(String(tx.status)) ||
    // R267_RECOVERY_FINAL: nunca aceitar estado contraditorio de liquidacao.
    (tx.status==='pending' && tx.affects_balance===true) ||
    (tx.status==='done' && tx.affects_balance!==true))fail('RECOVERY_LEDGER_MISMATCH');
 return {transaction_id:String(tx.id),consumed_at:result.consumed_at,
   status:tx.status,verified:true,ledgerReadOnly:true};
}
export async function inspectAtomicV2Recovery(db:Client,phone:string){
 const current=await sessionRow(db,phone);
 const result=restoredConsumedSession(current,{transaction_id:current.temp_data?.transaction_id});
 return {transaction_id:result.transaction_id,consumed_at:result.consumed_at,requiresLedgerVerification:true};
}
