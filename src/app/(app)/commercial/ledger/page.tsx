'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ShieldCheck, RefreshCw, Plus, ArrowRightLeft, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { formatCents, parseMoneyBR } from '@/lib/commercialSettlement'
import { parseCsv, mapSales, mapReceipts, type TablePreview } from '@/lib/commercialImport'
import { normalizeSales, normalizeReceipts } from '@/lib/commercialBatch'
import SelectField from '@/components/SelectField'
import PremiumDateField from '@/components/PremiumDateField'

type Store = { id: string; name: string }
type Platform = { id: string; store_id: string; display_name: string }
type Sale = { id: string; reference: string; sale_date: string; payable_cents: number; gross_cents: number; store_id: string; platform_id: string }
type Receipt = { id: string; reference: string; receipt_date: string; amount_cents: number; store_id: string; platform_id: string }
type Allocation = { id: string; sale_id: string; receipt_id: string; amount_cents: number; reversed_at: string | null }
const input = 'w-full rounded-2xl border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white'
const card = 'space-y-3 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900'
function dateToday() { const d=new Date(); const local=new Date(d.getTime()-d.getTimezoneOffset()*60_000); return local.toISOString().slice(0,10) }
export default function CommercialLedgerPage() {
  const router=useRouter()
  const {user,loading:authLoading}=useAuth()
  const {showToast}=useToast()
  const haptic=useHapticFeedback()
  const [stores,setStores]=useState<Store[]>([])
  const [platforms,setPlatforms]=useState<Platform[]>([])
  const [sales,setSales]=useState<Sale[]>([])
  const [receipts,setReceipts]=useState<Receipt[]>([])
  const [allocations,setAllocations]=useState<Allocation[]>([])
  const [storeId,setStoreId]=useState('')
  const [platformId,setPlatformId]=useState('')
  const [kind,setKind]=useState<'sale'|'receipt'>('sale')
  const [reference,setReference]=useState('')
  const [date,setDate]=useState(dateToday())
  const [gross,setGross]=useState('')
  const [payable,setPayable]=useState('')
  const [saleId,setSaleId]=useState('')
  const [receiptId,setReceiptId]=useState('')
  const [amount,setAmount]=useState('')
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [csvMode,setCsvMode]=useState<'sale'|'receipt'>('sale')
  const [csvTable,setCsvTable]=useState<TablePreview|null>(null)
  const [csvMapping,setCsvMapping]=useState<Record<string,string>>({})
  const [csvRows,setCsvRows]=useState<Record<string,unknown>[]>([])
  const [csvBusy,setCsvBusy]=useState(false)
  const [importReport,setImportReport]=useState('')
  const [showHistory,setShowHistory]=useState(false)
  const [search,setSearch]=useState('')
  const [onlyPending,setOnlyPending]=useState(false)
  const refresh=useCallback(async()=>{
    if(!user?.id)return
    setLoading(true)
    try{
      const [st,pl,sa,re,al]=await Promise.all([
        supabase.from('dfl_commercial_stores').select('id,name').eq('owner_id',user.id).order('name'),
        supabase.from('dfl_commercial_platforms').select('id,store_id,display_name').eq('owner_id',user.id).order('display_name'),
        supabase.from('dfl_commercial_sales').select('id,reference,sale_date,payable_cents,gross_cents,store_id,platform_id').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(500),
        supabase.from('dfl_commercial_receipts').select('id,reference,receipt_date,amount_cents,store_id,platform_id').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(500),
        supabase.from('dfl_commercial_allocations').select('id,sale_id,receipt_id,amount_cents,reversed_at').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(1000),
      ])
      for(const r of [st,pl,sa,re,al]) if(r.error)throw r.error
      setStores(st.data||[]);setPlatforms(pl.data||[]);setSales(sa.data||[]);setReceipts(re.data||[]);setAllocations(al.data||[])
      setError('')
    }catch(e){setError(e instanceof Error?e.message:'Falha ao carregar ledger')}
    finally{setLoading(false)}
  },[user?.id])
  useEffect(()=>{void refresh()},[refresh])
  const availablePlatforms=platforms.filter(p=>p.store_id===storeId)
  const scopeSales=useMemo(()=>sales.filter(s=>s.store_id===storeId&&s.platform_id===platformId),[sales,storeId,platformId])
  const scopeReceipts=useMemo(()=>receipts.filter(r=>r.store_id===storeId&&r.platform_id===platformId),[receipts,storeId,platformId])
  const remainingSale=(s:Sale)=>s.payable_cents-allocations.filter(a=>a.sale_id===s.id&&!a.reversed_at).reduce((n,a)=>n+a.amount_cents,0)
  const remainingReceipt=(r:Receipt)=>r.amount_cents-allocations.filter(a=>a.receipt_id===r.id&&!a.reversed_at).reduce((n,a)=>n+a.amount_cents,0)
  const matchingSales=scopeSales.filter(s=>s.reference.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))&&(!onlyPending||remainingSale(s)>0))
  const matchingReceipts=scopeReceipts.filter(r=>r.reference.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))&&(!onlyPending||remainingReceipt(r)>0))
  async function readCsv(file:File|undefined){
    setCsvTable(null);setCsvRows([]);setCsvMapping({});setImportReport('');setError('')
    if(!file)return
    try{
      if(file.size>2_000_000)throw Error('Arquivo maior que 2 MB')
      const table=parseCsv(await file.text());setCsvTable(table)
      const fields=csvMode==='sale'?['reference','date','gross','commission','processing','fixed','retention','adjustments']:['reference','date','amount']
      const next:Record<string,string>={}
      for(const field of fields){const h=table.headers.find(x=>x.toLowerCase()===field);if(h)next[field]=h}
      setCsvMapping(next)
    }catch(e){setError(e instanceof Error?e.message:'CSV inválido')}
  }
  function validateCsv(){
    if(!csvTable)return
    setError('');setImportReport('')
    try{
      const required=csvMode==='sale'?['reference','date','gross']:['reference','date','amount']
      if(required.some(k=>!csvMapping[k]))throw Error('Mapeie todas as colunas obrigatórias')
      const rows:Record<string,unknown>[]=csvMode==='sale'
        ?normalizeSales(mapSales(csvTable,{reference:csvMapping.reference,date:csvMapping.date,gross:csvMapping.gross,commission:csvMapping.commission,processing:csvMapping.processing,fixed:csvMapping.fixed,retention:csvMapping.retention,adjustments:csvMapping.adjustments})).map(s=>({reference:s.reference,date:s.date,gross_cents:s.grossCents,payable_cents:s.settlement.payableCents}))
        :normalizeReceipts(mapReceipts(csvTable,{reference:csvMapping.reference,date:csvMapping.date,amount:csvMapping.amount})).map(r=>({reference:r.reference,date:r.date,amount_cents:r.amountCents}))
      if(rows.length>500)throw Error('O PostgreSQL aceita no máximo 500 registros por lote. Divida o CSV em arquivos de até 500 linhas para manter a importação atômica.')
      setCsvRows(rows);showToast(`${rows.length} registros validados localmente.`, 'success')
    }catch(e){setCsvRows([]);setError(e instanceof Error?e.message:'Falha na validação')}
  }
  async function commitCsv(){
    if(!user?.id||!storeId||!platformId||!csvRows.length||csvBusy||busy||loading)return
    if(csvRows.length>500){setError('Máximo de 500 registros por importação atômica.');return}
    if(!window.confirm(`Importar ${csvRows.length} registros para o ledger comercial? Esta ação não movimenta contas financeiras.`))return
    setCsvBusy(true);setError('')
    try{
      const {data,error:rpcError}=await supabase.rpc('dfl_commercial_import_batch',{p_store:storeId,p_platform:platformId,p_kind:csvMode,p_rows:csvRows})
      if(rpcError)throw rpcError
      const result=data as {inserted?:number;skipped?:number}|null
      setImportReport(`Importação concluída: ${result?.inserted??0} novos, ${result?.skipped??0} já existentes.`)
      setCsvRows([]);setCsvTable(null);setCsvMapping({});haptic.success();await refresh()
    }catch(e){setError(e instanceof Error?e.message:'Falha ao importar');haptic.error()}
    finally{setCsvBusy(false)}
  }
  async function save(){
    if(!user?.id||!storeId||!platformId||busy||csvBusy||loading)return
    setBusy(true);setError('')
    try{
      if(!reference.trim()||reference.length>120||!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('Referência ou data inválida')
      const value=parseMoneyBR(gross)
      const common={owner_id:user.id,store_id:storeId,platform_id:platformId,reference:reference.trim()}
      const result=kind==='sale'
        ?await supabase.from('dfl_commercial_sales').insert({...common,sale_date:date,gross_cents:value,payable_cents:parseMoneyBR(payable)})
        :await supabase.from('dfl_commercial_receipts').insert({...common,receipt_date:date,amount_cents:value})
      if(result.error)throw result.error
      setReference('');setGross('');setPayable('');haptic.success();showToast('Registro comercial salvo, sem lançar no financeiro.','success');await refresh()
    }catch(e){setError(e instanceof Error?e.message:'Erro ao salvar');haptic.error()}
    finally{setBusy(false)}
  }
  async function allocate(){
    if(!saleId||!receiptId||busy||csvBusy||loading)return
    setBusy(true);setError('')
    try{
      const cents=parseMoneyBR(amount)
      const selectedSale=scopeSales.find(s=>s.id===saleId)
      const selectedReceipt=scopeReceipts.find(r=>r.id===receiptId)
      if(!selectedSale||!selectedReceipt)throw Error('Seleção desatualizada. Atualize os dados.')
      if(cents>remainingSale(selectedSale)||cents>remainingReceipt(selectedReceipt))throw Error('Valor acima do saldo disponível. Atualize os dados.')
      if(cents<=0)throw Error('Informe um valor maior que zero')
      const result=await supabase.rpc('dfl_commercial_allocate',{p_sale:saleId,p_receipt:receiptId,p_amount:cents})
      if(result.error)throw result.error
      setAmount('');haptic.success();showToast('Alocação registrada no ledger.','success');await refresh()
    }catch(e){setError(e instanceof Error?e.message:'Falha na conciliação');haptic.error()}
    finally{setBusy(false)}
  }
  async function reverse(id:string){
    if(busy||csvBusy||loading||!window.confirm('Reverter esta alocação? O evento ficará registrado para auditoria.'))return
    setBusy(true);setError('')
    try{
      const result=await supabase.rpc('dfl_commercial_reverse_allocation',{p_id:id})
      if(result.error)throw result.error
      haptic.success();showToast(result.data?'Alocação revertida.':'Alocação já revertida.','success');await refresh()
    }catch(e){setError(e instanceof Error?e.message:'Falha na reversão');haptic.error()}
    finally{setBusy(false)}
  }
  return <main className="mx-auto min-h-screen max-w-2xl space-y-4 px-4 pb-28 pt-5 text-slate-900 dark:text-slate-100">
    <header className="flex items-center gap-3"><button type="button" onClick={()=>router.push('/commercial')} aria-label="Voltar" className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800"><ArrowLeft size={18}/></button><div className="flex-1"><h1 className="text-xl font-bold">Ledger comercial</h1><p className="text-xs text-slate-500">Persistência supervisionada · sem lançamentos financeiros</p></div><button type="button" aria-label="Atualizar" onClick={()=>void refresh()} disabled={busy||loading}><RefreshCw size={19}/></button></header>
    <section className="flex gap-3 rounded-3xl border border-teal-500/30 bg-teal-500/5 p-4 text-sm"><ShieldCheck className="shrink-0 text-teal-500"/><p>Operação comercial supervisionada e isolada das contas financeiras. Importações são atômicas e divergências bloqueiam o lote. Homologação visual no APK/PWA ainda pendente.</p></section>
    {authLoading||!user?<p className={card}>Autenticação necessária.</p>:<>
    <section className={card}><h2 className="font-bold">Loja e plataforma</h2><SelectField title="Selecionar loja" placeholder="Selecionar loja" value={storeId} options={stores.map(s=>({value:s.id,label:s.name}))} onChange={value=>{setStoreId(value);setPlatformId('');setSaleId('');setReceiptId('');setCsvRows([]);setCsvTable(null);setImportReport('');setSearch('')}} /><SelectField title="Selecionar plataforma" placeholder="Selecionar plataforma" value={platformId} options={availablePlatforms.map(p=>({value:p.id,label:p.display_name}))} onChange={value=>{setPlatformId(value);setSaleId('');setReceiptId('');setCsvRows([]);setCsvTable(null);setImportReport('');setSearch('')}} /></section>
    {loading&&<p role="status" className="text-xs text-slate-500">Atualizando dados comerciais…</p>}
    {platformId&&<section className={card} aria-label="Resumo do ledger comercial"><h2 className="font-bold">Resumo da plataforma</h2><div className="grid grid-cols-2 gap-3">{[
      ['Vendas',String(scopeSales.length)],
      ['Bruto',formatCents(scopeSales.reduce((n,s)=>n+s.gross_cents,0))],
      ['Líquido previsto',formatCents(scopeSales.reduce((n,s)=>n+s.payable_cents,0))],
      ['Repasses',formatCents(scopeReceipts.reduce((n,r)=>n+r.amount_cents,0))],
      ['Conciliado',formatCents(allocations.filter(a=>!a.reversed_at&&scopeSales.some(s=>s.id===a.sale_id)).reduce((n,a)=>n+a.amount_cents,0))],
      ['A conciliar',formatCents(scopeSales.reduce((n,s)=>n+Math.max(0,remainingSale(s)),0))]
    ].map(([label,value])=><div key={label} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-base font-bold tabular-nums">{value}</p></div>)}</div><p className="text-xs text-slate-500">{sales.length>=500||receipts.length>=500||allocations.length>=1000?'Atenção: limite de carregamento atingido; indicadores parciais. Consulte exportação/relatórios para análise completa.':'Resumo dos registros carregados. Não movimenta contas bancárias.'}</p></section>}
    {error&&<p role="alert" className="rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-500">{error}</p>}
    {platformId&&<><section className={card}><h2 className="flex items-center gap-2 font-bold"><Plus size={18}/> Registro manual</h2><div className="grid grid-cols-2 gap-2">{(['sale','receipt'] as const).map(k=><button key={k} type="button" onClick={()=>setKind(k)} className={`rounded-xl p-3 text-sm ${kind===k?'bg-teal-600 text-white':'bg-slate-100 dark:bg-slate-800'}`}>{k==='sale'?'Venda':'Repasse'}</button>)}</div><input className={input} aria-label="Referência única" placeholder="Referência única" value={reference} onChange={e=>setReference(e.target.value)}/><PremiumDateField label="Data do registro" value={date} onChange={setDate} /><input className={input} aria-label="Valor bruto ou repasse" inputMode="decimal" placeholder={kind==='sale'?'Valor bruto (R$)':'Valor do repasse (R$)'} value={gross} onChange={e=>setGross(e.target.value)}/>{kind==='sale'&&<input className={input} aria-label="Valor líquido a receber" inputMode="decimal" placeholder="Valor líquido a receber (R$)" value={payable} onChange={e=>setPayable(e.target.value)}/>}<button type="button" disabled={busy||csvBusy||loading} onClick={()=>void save()} className="w-full rounded-2xl bg-teal-600 p-3 font-bold text-white disabled:opacity-50">Salvar no ledger</button></section>
    <section className={card}>
      <h2 className="font-bold">Importação CSV supervisionada</h2>
      <p className="text-xs text-slate-500">Mapeie colunas, valide toda a prévia e confirme. Até 500 registros por operação atômica. Duplicatas idênticas são ignoradas; divergências bloqueiam todo o lote. Não altera contas bancárias.</p>
      <div className="grid grid-cols-2 gap-2">{(['sale','receipt'] as const).map(m=><button key={m} type="button" className={`rounded-xl p-3 text-sm ${csvMode===m?'bg-teal-600 text-white':'bg-slate-100 dark:bg-slate-800'}`} onClick={()=>{setCsvMode(m);setCsvTable(null);setCsvRows([]);setCsvMapping({});setImportReport('')}}>{m==='sale'?'Vendas':'Repasses'}</button>)}</div>
      <input aria-label="Arquivo CSV" className={input} type="file" accept=".csv,text/csv,text/plain" onChange={e=>void readCsv(e.target.files?.[0])}/>
      {csvTable&&<><p className="text-sm">{csvTable.rows.length} linhas · {csvTable.headers.length} colunas</p>
        {(csvMode==='sale'?['reference','date','gross','commission','processing','fixed','retention','adjustments']:['reference','date','amount']).map(k=><label key={k} className="block text-xs font-semibold">{k}{['reference','date','gross','amount'].includes(k)?' *':''}<SelectField title={`Coluna: ${k}`} placeholder="Não mapear" value={csvMapping[k]||''} options={[{value:'',label:'Não mapear'},...csvTable.headers.map(h=>({value:h,label:h}))]} onChange={value=>{setCsvMapping(v=>({...v,[k]:value}));setCsvRows([])}} /></label>)}
        <button type="button" className="w-full rounded-2xl bg-slate-700 p-3 font-bold text-white" onClick={validateCsv}>Validar prévia</button></>}
      {csvRows.length>0&&<><p className="text-sm font-semibold">{csvRows.length} registros prontos · exemplos:</p>
        {csvRows.slice(0,3).map((r,i)=><p key={i} className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-slate-950">{String(r.reference)} · {String(r.date)} · {formatCents(Number(r.payable_cents??r.amount_cents))}</p>)}
        <button type="button" disabled={csvBusy||busy||loading} className="w-full rounded-2xl bg-teal-600 p-3 font-bold text-white disabled:opacity-50" onClick={()=>void commitCsv()}>{csvBusy?'Importando…':'Confirmar importação no ledger'}</button></>}
      {importReport&&<p role="status" className="rounded-xl bg-teal-500/10 p-3 text-sm text-teal-700 dark:text-teal-300">{importReport}</p>}
    </section>
    <section className={card}><h2 className="flex items-center gap-2 font-bold"><ArrowRightLeft size={18}/> Conciliação parcial</h2><p className="text-xs text-slate-500">Selecione uma venda e um repasse. É possível conciliar em várias parcelas; o banco bloqueia excesso e duplicação por referência.</p><SelectField title="Selecionar venda" placeholder="Selecionar venda" value={saleId} options={scopeSales.filter(s=>remainingSale(s)>0).map(s=>({value:s.id,label:`${s.reference} · disponível ${formatCents(remainingSale(s))}`}))} onChange={setSaleId} /><SelectField title="Selecionar repasse" placeholder="Selecionar repasse" value={receiptId} options={scopeReceipts.filter(r=>remainingReceipt(r)>0).map(r=>({value:r.id,label:`${r.reference} · disponível ${formatCents(remainingReceipt(r))}`}))} onChange={setReceiptId} /><input className={input} aria-label="Valor a alocar" inputMode="decimal" placeholder="Valor a conciliar (R$)" value={amount} onChange={e=>setAmount(e.target.value)}/><button type="button" disabled={busy||csvBusy||loading||!saleId||!receiptId} onClick={()=>void allocate()} className="w-full rounded-2xl bg-teal-600 p-3 font-bold text-white disabled:opacity-50">Registrar alocação</button></section>
    <section className={card} aria-label="Consulta de registros comerciais">
      <div className="flex items-center justify-between gap-2"><h2 className="font-bold">Consultar registros</h2><button type="button" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold dark:bg-slate-800" onClick={()=>setOnlyPending(v=>!v)} aria-pressed={onlyPending}>{onlyPending?'Somente pendentes ✓':'Filtrar pendentes'}</button></div>
      <input className={input} aria-label="Buscar referência comercial" placeholder="Buscar referência de venda ou repasse" value={search} onChange={e=>setSearch(e.target.value)}/>
      <div className="grid grid-cols-2 gap-3"><div><p className="mb-2 text-xs font-semibold text-slate-500">Vendas ({matchingSales.length})</p>{matchingSales.slice(0,12).map(s=><div key={s.id} className="mb-2 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><p className="truncate text-xs font-semibold">{s.reference}</p><p className="text-sm font-bold tabular-nums">{formatCents(s.payable_cents)}</p><p className="text-xs text-teal-600 dark:text-teal-300">Saldo {formatCents(remainingSale(s))}</p></div>)}{!matchingSales.length&&<p className="text-xs text-slate-500">Nenhuma venda encontrada</p>}</div><div><p className="mb-2 text-xs font-semibold text-slate-500">Repasses ({matchingReceipts.length})</p>{matchingReceipts.slice(0,12).map(r=><div key={r.id} className="mb-2 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950"><p className="truncate text-xs font-semibold">{r.reference}</p><p className="text-sm font-bold tabular-nums">{formatCents(r.amount_cents)}</p><p className="text-xs text-teal-600 dark:text-teal-300">Saldo {formatCents(remainingReceipt(r))}</p></div>)}{!matchingReceipts.length&&<p className="text-xs text-slate-500">Nenhum repasse encontrado</p>}</div></div>
      {(matchingSales.length>12||matchingReceipts.length>12)&&<p className="text-xs text-slate-500">Exibindo até 12 resultados por tipo. Refine a busca para localizar outros registros.</p>}
    </section>
    <section className={card}><div className="flex items-center justify-between gap-2"><h2 className="font-bold">Histórico de alocações</h2><button type="button" aria-expanded={showHistory} onClick={()=>setShowHistory(v=>!v)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold dark:bg-slate-800">{showHistory?'Recolher':'Ver histórico'}</button></div>{showHistory&&<div className="space-y-2">{allocations.filter(a=>scopeSales.some(s=>s.id===a.sale_id)).map(a=><div key={a.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-950"><div><p className="font-semibold">{formatCents(a.amount_cents)}</p><p className="text-xs text-slate-500">{scopeSales.find(s=>s.id===a.sale_id)?.reference} / {scopeReceipts.find(r=>r.id===a.receipt_id)?.reference}</p></div>{a.reversed_at?<span className="text-xs text-slate-500">Revertida</span>:<button type="button" disabled={busy||csvBusy||loading} onClick={()=>void reverse(a.id)} className="flex items-center gap-1 text-xs font-semibold text-rose-500"><RotateCcw size={14}/> Reverter</button>}</div>)}{!allocations.some(a=>scopeSales.some(s=>s.id===a.sale_id))&&<p className="text-xs text-slate-500">Ainda não existem alocações para esta plataforma.</p>}</div>}</section>
</>}
    </>}
  </main>
}
