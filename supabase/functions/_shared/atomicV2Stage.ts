/* R242–R249. Grava SOMENTE o snapshot da sessão, nunca o ledger.
 * NÃO executar como etapa separada de autorização financeira: a execução final
 * deve ocorrer integralmente na RPC transacional V2. */
import {preparedAtomicSession} from './atomicV2Session.ts';

type Client={rpc:(name:string,args:Record<string,unknown>)=>Promise<{data?:any,error?:any}>};
export async function stageAtomicV2Snapshot(db:Client,u:any,phone:string,sd:any,acc:any,cat:any,params:any,current:any){
 if(!db || typeof db.rpc!=='function')throw new Error('DFL_V2_STAGE_CLIENT');
 const checked=preparedAtomicSession(u,sd,acc,cat,params,current);
 if(!phone || checked.phone!==phone)throw new Error('DFL_V2_STAGE_PHONE');
 if(current.temp_data?.atomic_snapshot)throw new Error('DFL_V2_STAGE_ALREADY_FROZEN');
 /* R324-R329: snapshot unico para CAS e validacao SQL.
    Os campos canonicos de topo sao derivados do snapshot validado. */
 const next={...current.temp_data,...checked.snapshot,atomic_snapshot:checked.snapshot};
 const {data,error}=await db.rpc('dfl_bot_session_cas',{
  p_phone:phone,
  p_expected_revision:checked.revision,
  p_expected_step:checked.step,
  p_new_step:checked.step,
  p_new_temp_data:next,
 });
 if(error)throw error;
 if(!data || data.applied!==true || !Number.isSafeInteger(Number(data.revision)) ||
    Number(data.revision)!==checked.revision+1)throw new Error('DFL_V2_STAGE_STALE');
 return {revision:Number(data.revision),snapshot:checked.snapshot,step:checked.step};
}
