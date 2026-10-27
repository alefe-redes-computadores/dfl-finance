/* R151-R156: ponte financeira opcional, DESLIGADA por padrao.
 * Depende de migrations R133 e R146 no servidor. Nunca trocar por fluxo legado
 * quando opt-in estiver ativo e a validacao/execucao falhar.
 * Escopo: APENAS income/expense unitario. Nao alterar transferencia,
 * recorrencia, quitacao, recibos ou o fluxo normal sem a flag.
 */
type Db = { from: (table: string) => any; rpc: (name: string, params: any) => PromiseLike<{ data: any; error: any }> };
const steps = new Set(['TX_CONFIRM','TX_ACC','TX_CAT','TX_CAT_ALL']);
const reject = (message: string): never => { throw new Error('DFL_ATOMIC_BOT: ' + message); };
const str = (v: unknown) => String(v ?? '');
const normalized = (v: unknown) => v === null || v === undefined || v === '' ? null : str(v);

export async function atomicBotFinalize(db: Db, phone: string, txid: string, sd: any, acc: any, cat: any, heldReceiptLinked: boolean) {
  const current=await db.from('bot_sessions').select('revision,temp_data,step').eq('phone',phone).maybeSingle();
  if(current.error)throw current.error;
  if(current.data?.step!=='TX_SETTLE'||!current.data.temp_data?.consumed_at) return reject('estado pos-commit invalido');
  const next={...current.data.temp_data,transaction_id:txid,type:sd.type,amount:sd.amount,account:acc,category:cat,receipt_attached:heldReceiptLinked};
  const updated=await db.rpc('dfl_bot_session_cas',{p_phone:phone,p_expected_revision:current.data.revision,p_expected_step:'TX_SETTLE',p_new_step:'TX_SETTLE',p_new_temp_data:next});
  if(updated.error)throw updated.error;
  if(updated.data?.applied!==true) return reject('estado pos-commit concorrente');
}

export async function atomicBotSingle(db: Db, u: any, phone: string, sd: any, acc: any, cat: any, params: any, rpc: string) {
  if (rpc !== 'bot_record_transaction' || sd.recurrence) return reject('fluxo nao suportado');
  if (typeof phone !== 'string' || !phone.trim()) return reject('telefone invalido');
  if (!u?.user_id || !acc?.id || !params?.p_idempotency_key) return reject('identidade incompleta');
  if (sd.type !== 'income' && sd.type !== 'expense') return reject('tipo nao permitido');
  if (!Number.isFinite(Number(sd.amount)) || Number(sd.amount) <= 0) return reject('valor invalido');
  const lookup = await db.from('bot_sessions').select('step,revision,temp_data').eq('phone',phone).maybeSingle();
  if (lookup.error) throw lookup.error;
  const row=lookup.data;
  if (!row || !(steps.has(row.step) || (row.step==='TX_SETTLE' && row.temp_data?.consumed_at)) || !Number.isSafeInteger(row.revision) || row.revision<0) return reject('sessao invalida ou schema nao migrado');
  if (!row.temp_data || typeof row.temp_data !== 'object' || Array.isArray(row.temp_data)) return reject('payload invalido');
  // O provider id e unico no banco e acompanha a operacao financeira.
  const key=str(params.p_idempotency_key);
  const proposalId='tx:'+key;
  const snapshot={
    ...row.temp_data,
    proposal_id:proposalId,
    user_id:str(u.user_id),
    account_id:str(acc.id),
    category_id:normalized(cat?.id),
    idempotency_key:key,
    type:str(sd.type),amount:Number(sd.amount),
    description:str(sd.description),context:str(sd.context),
    date:str(params.p_date)
  };
  if (!snapshot.description.trim() || !snapshot.context || !/^\d{4}-\d\d-\d\d$/.test(snapshot.date)) return reject('snapshot incompleto');
  if (row.temp_data.proposal_id && row.temp_data.proposal_id!==proposalId) return reject('proposta concorrente existente');
  if (row.temp_data.proposal_id){
    const fields=['user_id','account_id','category_id','idempotency_key','type','amount','description','context','date'];
    if(fields.some(k=>normalized(row.temp_data[k])!==normalized(snapshot[k]))) return reject('snapshot congelado divergente');
  }
  /* DFL_BOT_ATOMIC_RECOVERY_R157: se a operacao ja comitou, jamais registrar
     outra. Somente a MESMA proposta, campos e chave recebe o ID duravel. */
  if (row.temp_data.consumed_at || row.temp_data.transaction_id) {
    if (row.step !== 'TX_SETTLE' || !row.temp_data.consumed_at || !row.temp_data.transaction_id ||
        row.temp_data.proposal_id !== proposalId ||
        normalized(row.temp_data.idempotency_key) !== normalized(key)) return reject('proposta ja utilizada');
    return { data: {atomic:true,duplicate:true,transaction_id:str(row.temp_data.transaction_id),
      recovered:true,proposal_id:proposalId},error:null };
  } else {
    // CAS protege a congelacao. Em caso de conflito nao repetimos com revisao nova.
    const freeze=await db.rpc('dfl_bot_session_cas',{
      p_phone:phone,p_expected_revision:row.revision,p_expected_step:row.step,
      p_new_step:row.step,p_new_temp_data:snapshot
    });
    if(freeze.error) throw freeze.error;
    if(freeze.data?.applied!==true || !Number.isSafeInteger(freeze.data?.revision)) return reject('CAS perdeu concorrencia');
    row.revision=freeze.data.revision;
  }
  const execution=await db.rpc('dfl_bot_record_single_atomic_r146',{
    p_user_id:u.user_id,p_phone:phone,p_expected_revision:row.revision,
    p_expected_step:row.step,p_expected_proposal:proposalId,
    p_account_id:acc.id,p_category_id:cat?.id||null,
    p_type:sd.type,p_amount:Number(sd.amount),p_description:sd.description,
    p_context:sd.context,p_idempotency_key:params.p_idempotency_key,p_date:params.p_date
  });
  if(execution.error) throw execution.error;
  if(execution.data?.atomic!==true) return reject('resposta sem comprovacao atomica');
  return execution;
}
