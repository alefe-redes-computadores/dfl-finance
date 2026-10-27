/** R283–R290 R2: handoff fechado do webhook para o orquestrador V2.
 * NAO importado pelo webhook: ativacao exige E2E com ledger real e migracao.
 * Este modulo nao tem fallback financeiro legado nem altera saldo diretamente.
 */
import { runAtomicV2Integration } from './atomicV2Integration.ts';

type Input={db:any;u:any;phone:string;sd:any;acc:any;cat:any;params:any};
const error=(m:string):never=>{throw new Error('DFL_V2_HANDOFF_'+m)};
function validate(x:Input){
 if(!x?.db||!x.u?.user_id||!x.phone||!x.sd?.provider_message_id||!x.acc?.id||
    !x.params?.p_idempotency_key||x.sd?.recurrence||
    !['expense','income'].includes(String(x.sd?.type))||
    String(x.params.p_user_id)!==String(x.u.user_id)||
    String(x.params.p_account_id)!==String(x.acc.id)||
    String(x.params.p_category_id??'')!==String(x.cat?.id??'')||
    !Number.isFinite(Number(x.params.p_amount))||Number(x.params.p_amount)<=0||
    Number(x.sd.amount)!==Number(x.params.p_amount)||
    String(x.sd.description)!==String(x.params.p_description)||
    String(x.sd.context)!==String(x.params.p_context)||
    String(x.sd.type)!==String(x.params.p_type)||
    String(x.sd.date)!==String(x.params.p_date)
 )error('INVALID_FINANCIAL_IDENTITY');
}
export async function handoffAtomicV2(x:Input){
 validate(x);
 // Primeiro preparar. Se CAS falhar, abortar SEM chamada financeira.
 const prepared=await runAtomicV2Integration('prepare',x);
 if(prepared?.phase!=='prepared')error('NOT_PREPARED');
 // Somente depois do CAS confirmado solicitar a RPC SQL atomica.
 const committed=await runAtomicV2Integration('commit',x);
 if(committed?.phase!=='committed'||!committed?.transaction_id)error('COMMIT_UNVERIFIED');
 return {transaction_id:String(committed.transaction_id),phase:'committed',mode:'atomic_v2'};
}
export async function recoverAtomicV2Handoff(x:Input){
 validate(x);
 // Somente leitura do ledger; nunca execute prepare/commit para recuperar.
 const recovered=await runAtomicV2Integration('recover',x);
 if(recovered?.phase!=='recovered'||recovered?.verified!==true||!recovered?.transaction_id)
   error('LEDGER_UNVERIFIED');
 return {transaction_id:String(recovered.transaction_id),phase:'recovered',verified:true};
}
