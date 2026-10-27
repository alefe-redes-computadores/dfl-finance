/* R170-R176: rota v2 preparatoria. NAO ligada ao webhook. Sem CAS separado. */
type Db = { from: (table:string)=>any; rpc: (name:string,params:any)=>PromiseLike<{data:any;error:any}> };
const fail=(reason:string):never=>{throw new Error('DFL_ATOMIC_V2: '+reason)};
export async function atomicBotSingleV2(db:Db,u:any,phone:string,sd:any,acc:any,cat:any,params:any){
 if(sd?.recurrence || !['income','expense'].includes(sd?.type))fail('tipo nao permitido');
 /* R205-R211: o helper só aceita a proposta financeira completa e congruente. */
 if(!sd?.provider_message_id || !sd?.description || !sd?.context || !sd?.date ||
    !params?.p_date || !Number.isFinite(Number(sd?.amount)) || Number(sd.amount)<=0 ||
    params.p_account_id!==acc?.id || params.p_category_id!==(cat?.id??null) ||
    params.p_type!==sd.type || Number(params.p_amount)!==Number(sd.amount) ||
    params.p_description!==sd.description || params.p_context!==sd.context ||
    params.p_date!==sd.date)fail('proposta financeira incompleta ou divergente');
 if(!u?.user_id || !acc?.id || !params?.p_idempotency_key)fail('identidade ausente');
 const row=await db.from('bot_sessions').select('step,revision,temp_data').eq('phone',phone).maybeSingle();
 if(row.error)throw row.error;
 const session=row.data;
 if(!session || !Number.isSafeInteger(session.revision) || session.revision<0)fail('sessao sem versao');
 if(session.step==='TX_SETTLE' && session.temp_data?.consumed_at){
   /* Retry NAO executa RPC: valido apenas com identidade exata da proposta. */
   const key=String(params.p_idempotency_key), proposal='tx:'+key;
   if(session.temp_data.proposal_id!==proposal || session.temp_data.idempotency_key!==key ||
     String(session.temp_data.user_id)!==String(u.user_id) ||
     String(session.temp_data.account_id)!==String(acc.id) ||
     String(session.temp_data.category_id??'')!==String(cat?.id??'') ||
     String(session.temp_data.type)!==String(sd.type) ||
     Number(session.temp_data.amount)!==Number(sd.amount) ||
     String(session.temp_data.description)!==String(sd.description) ||
     String(session.temp_data.context)!==String(sd.context) ||
     String(session.temp_data.date)!==String(params.p_date) ||
     !session.temp_data.transaction_id)fail('retry divergente');
   fail('retry exige comprovacao via ledger; use verifyAtomicV2Recovery');
 }
 if(!['TX_CONFIRM','TX_ACC','TX_CAT','TX_CAT_ALL'].includes(session.step))fail('etapa nao permitida');
 const r=await db.rpc('dfl_bot_commit_single_v2',{
  p_user_id:u.user_id,p_phone:phone,p_expected_revision:session.revision,
  p_expected_step:session.step,p_proposal_id:'tx:'+params.p_idempotency_key,
  p_account_id:acc.id,p_category_id:cat?.id??null,p_type:sd.type,
  p_amount:Number(sd.amount),p_description:sd.description,p_context:sd.context,
  p_idempotency_key:params.p_idempotency_key,p_date:params.p_date
 });
 if(r.error)throw r.error;
 if(r.data?.atomic!==true || !r.data?.transaction_id)fail('comprovante atomico ausente');
 return r;
}
