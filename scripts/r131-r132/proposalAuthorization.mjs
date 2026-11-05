/** R131: contrato PURO de autorizacao. Nao e integracao com banco. */
export function validateProposalAuthorization(state, request, now) {
  if (!state || !request) return {ok:false,code:'missing'}
  if (!Number.isSafeInteger(state.revision) || state.revision<0) return {ok:false,code:'invalid_revision'}
  if (!Number.isSafeInteger(request.revision) || request.revision!==state.revision) return {ok:false,code:'stale'}
  if (state.status!=='pending') return {ok:false,code:'already_claimed'}
  if (typeof request.messageId!=='string' || !request.messageId.trim()) return {ok:false,code:'missing_message'}
  if (typeof state.proposalId!=='string'|| !state.proposalId || request.proposalId!==state.proposalId) return {ok:false,code:'wrong_proposal'}
  if (!Number.isFinite(now)|| !Number.isFinite(state.expiresAt)||now>=state.expiresAt) return {ok:false,code:'expired'}
  return {ok:true,code:'valid'}
}
/** Apenas simulacao de CAS. Em producao deve ocorrer numa unica transacao SQL. */
export function claimInMemory(row, req, now) {
  const verdict=validateProposalAuthorization(row,req,now)
  if(!verdict.ok)return {result:verdict,state:row}
  return {result:{ok:true,code:'claimed'},state:{...row,status:'claimed',claimedBy:req.messageId}}
}
