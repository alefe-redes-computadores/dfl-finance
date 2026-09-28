import { db } from '@/lib/db'
export type GlobalSearchResult={id:string;kind:string;title:string;subtitle:string;href:string;amount?:number;date?:string}
const norm=(v:unknown)=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
export async function searchFinancialData(userId:string,context:'dfl'|'personal',query:string,limit=40):Promise<GlobalSearchResult[]>{
 const term=norm(query); if(term.length<2)return[]
 const names=['transactions','accounts','credit_cards','debts','loans','financings','subscriptions','goals','categories'] as const
 const rows=await Promise.all(names.map(n=>(db as any)[n].where('[user_id+context]').equals([userId,context]).toArray()))
 const out:GlobalSearchResult[]=[]
 const cfg:any={transactions:['transaction','Transação','/transactions/details?id='],accounts:['account','Conta','/accounts/details?id='],credit_cards:['card','Cartão','/cards/details?id='],debts:['debt','Quem me deve','/debts/details?id='],loans:['loan','Empréstimo','/loans/details?id='],financings:['financing','Financiamento','/financings/details?id='],subscriptions:['subscription','Recorrência','/subscriptions/details?id='],goals:['goal','Meta','/goals/details?id='],categories:['category','Categoria','/categories']}
 names.forEach((name,i)=>rows[i].forEach((r:any)=>{const hay=[r.description,r.name,r.title,r.notes,r.amount].map(norm).join(' ');if(!hay.includes(term))return;const [kind,label,base]=cfg[name];out.push({id:r.id,kind,title:r.description||r.name||r.title||label,subtitle:label,href:name==='categories'?base:`${base}${encodeURIComponent(r.id)}`,amount:Number(r.amount??r.balance??r.total_amount??r.remaining_amount)||undefined,date:r.date||r.updated_at||r.created_at})}))
 return out.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,limit)
}
