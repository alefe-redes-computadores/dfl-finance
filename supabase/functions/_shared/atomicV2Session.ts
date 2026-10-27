/* R235–R241: preparar e comparar o snapshot da sessao. Sem escrita financeira. */
import {freezeAtomicSnapshot,sameAtomicSnapshot} from './atomicBotV2Bridge.ts';

export function preparedAtomicSession(u:any, sd:any, acc:any, cat:any, params:any, current:any) {
  const snapshot=freezeAtomicSnapshot(u,sd,acc,cat,params);
  if(!current || typeof current!=='object')throw new Error('DFL_V2_SESSION_MISSING');
  if(current.step!=='TX_CONFIRM' && current.step!=='TX_ACC' && current.step!=='TX_CAT' && current.step!=='TX_CAT_ALL')throw new Error('DFL_V2_SESSION_STEP');
  if(!Number.isSafeInteger(Number(current.revision)) || Number(current.revision)<0)throw new Error('DFL_V2_SESSION_REVISION');
  if(current.temp_data?.consumed_at || current.temp_data?.transaction_id)throw new Error('DFL_V2_SESSION_CONSUMED');
  const existing=current.temp_data||{};
  if(existing.provider_message_id!==snapshot.provider_message_id)throw new Error('DFL_V2_MESSAGE_MISMATCH');
  if(existing.atomic_snapshot && !sameAtomicSnapshot(existing.atomic_snapshot,snapshot))throw new Error('DFL_V2_SNAPSHOT_CHANGED');
  return {phone:String(current.phone||''),step:current.step,revision:Number(current.revision),snapshot};
}

export function assertAtomicCommitResult(result:any, expected:any){
  if(!result || !result.atomic || !result.transaction_id)throw new Error('DFL_V2_COMMIT_INVALID');
  if(result.proposal_id!==expected.snapshot.proposal_id || Number(result.authorized_revision)!==expected.revision)throw new Error('DFL_V2_COMMIT_MISMATCH');
  return String(result.transaction_id);
}

export function restoredConsumedSession(current:any, result:any){
  if(!current || current.step!=='TX_SETTLE' || !current.temp_data?.consumed_at || !current.temp_data?.transaction_id)throw new Error('DFL_V2_RECOVERY_NOT_CONSUMED');
  if(result && String(result.transaction_id)!==String(current.temp_data.transaction_id))throw new Error('DFL_V2_RECOVERY_MISMATCH');
  return {transaction_id:String(current.temp_data.transaction_id),consumed_at:String(current.temp_data.consumed_at)};
}
