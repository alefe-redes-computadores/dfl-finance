/** R275–R282: orquestrador funcional preparado, SEM ativacao no webhook.
 * Nao executa fallback financeiro. Preparar, confirmar e recuperar sao comandos
 * explicitamente separados. A recuperacao consulta o ledger (read-only).
 */
import { prepareAtomicV2Session, commitPreparedAtomicV2, verifyAtomicV2Recovery } from './atomicV2Orchestrator.ts';

type Input={db:any;u:any;phone:string;sd:any;acc:any;cat:any;params:any};
type Action='prepare'|'commit'|'recover';
function invalid(reason:string):never{throw new Error('DFL_V2_INTEGRATION_'+reason)}
function identity(input:Input){
 if(!input?.db || !input.phone || !input.u?.user_id || !input.sd?.provider_message_id ||
    !input.acc?.id || !input.params?.p_idempotency_key ||
    String(input.params.p_user_id)!==String(input.u.user_id) ||
    String(input.params.p_account_id)!==String(input.acc.id) ||
    String(input.params.p_category_id??'')!==String(input.cat?.id??'') ||
    !['income','expense'].includes(String(input.sd.type)) ||
    !Number.isFinite(Number(input.sd.amount)) || Number(input.sd.amount)<=0 ||
    !!input.sd.recurrence)invalid('INVALID_INPUT');
}
export async function runAtomicV2Integration(action:Action,input:Input){
 if(!['prepare','commit','recover'].includes(action))invalid('INVALID_ACTION');
 identity(input);
 if(action==='prepare')return {phase:'prepared',result:await prepareAtomicV2Session(input)};
 if(action==='commit'){
   const result=await commitPreparedAtomicV2(input);
   if(result?.error)throw result.error;
   const txid=result?.data?.transaction_id ?? result?.transaction_id;
   if(!txid)invalid('MISSING_FINANCIAL_RECEIPT');
   return {phase:'committed',transaction_id:String(txid),result};
 }
 const verified=await verifyAtomicV2Recovery(input);
 if(verified?.verified!==true || verified?.ledgerReadOnly!==true || !verified?.transaction_id)
   invalid('RECOVERY_UNVERIFIED');
 return {phase:'recovered',transaction_id:String(verified.transaction_id),status:verified.status,verified:true};
}
