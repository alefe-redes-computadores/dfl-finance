/* R205-R211: helper puro, ainda NAO integrado ao webhook. Zero mutacoes financeiras. */
export type AtomicSnapshot={proposal_id:string;user_id:string;account_id:string;category_id:string|null;idempotency_key:string;type:'expense'|'income';amount:number;description:string;context:'dfl'|'personal';date:string;provider_message_id:string};
export function freezeAtomicSnapshot(u:any,sd:any,acc:any,cat:any,params:any):AtomicSnapshot{
 const key=String(params?.p_idempotency_key||'');
 const user_id=String(u?.user_id||'');
 const account_id=String(acc?.id||'');
 const provider_message_id=String(sd?.provider_message_id||'');
 const type=sd?.type,context=sd?.context;
 const amount=Number(sd?.amount),description=String(sd?.description||'').trim();
 const date=String(params?.p_date||'');
 if(!key||!user_id||!account_id||!provider_message_id||!description||!Number.isFinite(amount)||amount<=0||!['income','expense'].includes(type)||!['dfl','personal'].includes(context)||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('DFL_V2_SNAPSHOT_INVALID');
 if(params.p_account_id!==acc.id||params.p_category_id!==(cat?.id??null)||params.p_type!==type||Number(params.p_amount)!==amount||params.p_description!==sd.description||params.p_context!==context||params.p_date!==date)throw new Error('DFL_V2_SNAPSHOT_MISMATCH');
 return {proposal_id:'tx:'+key,user_id,account_id,category_id:cat?.id??null,idempotency_key:key,type,amount,description:sd.description,context,date,provider_message_id};
}
export function sameAtomicSnapshot(data:any,expected:AtomicSnapshot){
 if(!data||typeof data!=='object')return false;
 const fields=['proposal_id','user_id','account_id','category_id','idempotency_key','type','amount','description','context','date','provider_message_id'] as const;
 return fields.every(k=>Object.prototype.hasOwnProperty.call(data,k)&&String(data[k]??'')===String(expected[k]??''));
}
