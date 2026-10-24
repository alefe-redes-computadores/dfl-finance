import { trustedWebhook, readBoundedJson, receiptMimeMatches } from '../_shared/requestSecurity.ts';
import { buildFinancePace } from '../_shared/financePace.ts';
import { buildFinancePlanning, normalizePlanningGroups, normalizePlanningReserves, normalizePlanningFlexLimits } from '../_shared/financePlanning.ts';
import { parseFinanceComparison, aggregateFinanceMonths, financeCompareDelta, monthLabel } from '../_shared/financeComparisons.ts';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const N=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const money=(v:any)=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
/* V154: only vary conversational copy. All financial values and actions stay deterministic. */
const voiceIndex=(seed:string,stage:string,count:number)=>{let h=2166136261;for(const ch of seed+"|"+stage){h=Math.imul(h^ch.charCodeAt(0),16777619)}return (h>>>0)%count};
const voicePick=(seed:string,stage:string,options:string[])=>options[voiceIndex(seed,stage,options.length)];
const voiceAmount=(kind:string,seed:string,retry=false)=>{
 const income=kind==="income";
 const openings=income?["💰 *Quanto entrou?*","💰 *Qual foi o valor da receita?*","💰 *Me conta o valor que recebeu.*","💰 *Vamos registrar essa entrada. Qual o valor?*","💰 *Beleza, quanto você recebeu?*"]:["💸 *Quanto saiu?*","💸 *Qual foi o valor da despesa?*","💸 *Me conta quanto gastou.*","💸 *Vamos registrar esse gasto. Qual o valor?*","💸 *Certo, quanto você pagou?*"];
 const examples=income?["185 do balcão na Stone","420,50 do iFood na InfinitPay","75 recebidos em dinheiro","248 de vendas na PagBank","96,80 de vendas na carteira","312 do iFood na InfinitPay"]:["73,40 de combustível na Nubank","48,90 de material na carteira","125 de fornecedor na Stone","39,50 de estacionamento no Inter","86 de manutenção na PagBank","62,30 de mercado na Nubank"];
 const index=voiceIndex(seed,retry?"amount.retry":"amount.start",openings.length);
 const example=examples[voiceIndex(seed,retry?"example.retry":"example.start",examples.length)];
 return openings[index]+"\n\n"+(retry?"Pode enviar o valor, por exemplo *"+example+"*.":"Pode mandar só o valor ou escrever naturalmente, tipo *"+example+"*.");
};
const voiceConfirm=(seed:string)=>voicePick(seed,"confirmation",["🤖 *Entendi assim:*","🤖 *Beleza, confere pra mim:*","🤖 *Certo, ficou assim:*","🤖 *Peguei. Antes de registrar:*","🤖 *Olha se está certinho:*","🤖 *Organizei assim:*"]);
const voiceConfirmQuestion=(seed:string)=>voicePick(seed,"confirmation.question",["Tá certo?","Posso registrar assim?","Confere?","Está tudo certo?"]);
/* V155: state-scoped conversational choices; no ambiguous money movement. */
/* V162_CORRECTION_HELPERS_START: rascunho financeiro puro; sem qualquer RPC. */
const txCorrectionFocus=(raw:string):string|null=>{
  const n=N(raw).replace(/\s+/g," ").trim();
  if(/\b(nome|descricao|titulo|historico)\b/.test(n))return "description";
  if(/\b(valor|quantia|preco)\b/.test(n))return "amount";
  if(/\b(conta|banco|carteira)\b/.test(n))return "account";
  if(/\b(categoria)\b/.test(n))return "category";
  if(/\b(contexto|empresa|pessoal)\b/.test(n))return "context";
  if(/\b(data|dia|quando)\b/.test(n))return "date";
  return null;
};
const txCorrectionSegments=(raw:string):string[]=>{
  const normalizedStart=raw.replace(/^\s*(?:corrigir|corrige|mudar|muda|altera(?:r)?|troca(?:r)?|ajusta(?:r)?)\s+(?=(?:o\s+|a\s+)?(?:nome|descri(?:cao|ção)|t[ií]tulo|hist[oó]rico|valor|quantia|preco|conta|banco|categoria|contexto|data)\b)/i,"");
  const pieces=normalizedStart.replace(/\r/g,"")
    .replace(/\b(?:na|pela|em)\s+conta\b/gi,m=>m.replace(/\s+/g,"_"))
    .replace(/\s+(?:e\s+)?(?=(?:(?:corrigir|corrige|mudar|altera(?:r)?|troca(?:r)?)\s+)?(?:nome|descricao|descrição|titulo|título|valor|categoria|na_conta|pela_conta|em_conta|conta|no banco|contexto|data)\b)/gi,"\n")
    .split(/[\n;]+/).map(x=>x.trim().replace(/\b(?:na|pela|em)_conta\b/gi,m=>m.replace("_"," "))).filter(Boolean);
  const out:string[]=[];
  for(let i=0;i<pieces.length;i++){
    const x=pieces[i];
    if(/^(?:na\s+conta|pela\s+conta|em\s+conta|conta|no\s+banco)\s*:?$/i.test(x)&&i+1<pieces.length){out.push(x+" "+pieces[++i]);continue}
    out.push(x);
  }
  return out;
};
const txCorrectionPatch=(raw:string,focus:string|null=null)=>{
  const patch:any={},errors:string[]=[],fields:string[]=[];
  const parts=txCorrectionSegments(raw);
  const put=(key:string,value:any)=>{patch[key]=value;if(!fields.includes(key))fields.push(key)};
  for(const piece of parts){
    const n=N(piece);
    const amountMatch=n.match(/^(?:(?:corrigir|corrige|mudar|altera(?:r)?|troca(?:r)?|ajustar)\s+)?(?:o\s+)?(?:valor|quantia|preco)\s*(?:para|de|:|=)?\s*(.+)$/i);
    const descMatch=piece.match(/^(?:(?:corrigir|corrige|mudar|altera(?:r)?|troca(?:r)?|ajustar)\s+)?(?:o\s+|a\s+)?(?:nome(?:\s+d[ao]\s+(?:lancamento|lançamento|transacao|transação))?|descri(?:cao|ção)|t[ií]tulo|hist[oó]rico)\s*(?:para|de|:|=)?\s*(.+)$/i);
    const shortDesc=piece.match(/^de\s+["“']?(.+?)['”"]?$/i);
    const accountMatch=piece.match(/^(?:(?:corrigir|corrige|mudar|altera(?:r)?|troca(?:r)?|ajustar)\s+)?(?:a\s+|o\s+)?(?:na\s+conta|pela\s+conta|em\s+conta|conta|no\s+banco|banco)\s*(?:para|de|:|=)?\s*(.+)$/i);
    const catMatch=piece.match(/^(?:(?:corrigir|corrige|mudar|altera(?:r)?|troca(?:r)?|ajustar)\s+)?(?:a\s+)?categoria\s*(?:para|de|:|=)?\s*(.+)$/i);
    const contextMatch=piece.match(/^(?:(?:corrigir|corrige|mudar|altera(?:r)?|troca(?:r)?|ajustar)\s+)?(?:o\s+)?contexto\s*(?:para|de|:|=)?\s*(.+)$/i);
    const dateMatch=piece.match(/^(?:(?:corrigir|corrige|mudar|altera(?:r)?|troca(?:r)?|ajustar)\s+)?(?:a\s+)?data\s*(?:para|de|:|=)?\s*(.+)$/i);
    const clean=(x:string)=>x.replace(/^\s*(?:para|de)\s+/i,"").trim().replace(/^["'“”]+|["'“”]+$/g,"").trim();
    if(amountMatch || (focus==="amount"&&parts.length===1)){
      const x=amount(amountMatch?amountMatch[1]:piece);
      if(!x)errors.push("Valor inválido: "+piece);else put("amount",x);
    }else if(descMatch||shortDesc||(focus==="description"&&parts.length===1)){
      const value=clean(descMatch?descMatch[1]:shortDesc?shortDesc[1]:piece).replace(/[{}\[\]]/g," ").replace(/\s+/g," ").trim();
      if(!value||value.length>160)errors.push("Nome/descrição inválido: "+piece);else put("description",value);
    }else if(accountMatch||(focus==="account"&&parts.length===1)){
      const value=clean(accountMatch?accountMatch[1]:piece);
      if(!value)errors.push("Conta vazia");else put("accountName",value);
    }else if(catMatch||(focus==="category"&&parts.length===1)){
      const value=clean(catMatch?catMatch[1]:piece);
      if(!value)errors.push("Categoria vazia");else put("categoryName",value);
    }else if(contextMatch||(focus==="context"&&parts.length===1)){
      const value=N(contextMatch?contextMatch[1]:piece);
      if(/^(empresa|empresarial|dfl|da familia)$/.test(value))put("context","dfl");
      else if(/^(pessoal|personal)$/.test(value))put("context","personal");
      else errors.push("Contexto não reconhecido: "+piece);
    }else if(dateMatch||/\b(ontem|anteontem|hoje|amanha|amanhã)\b/i.test(piece)||((focus==="date"&&parts.length===1))){
      const dateInput=dateMatch?dateMatch[1]:piece;
      const iso=explicitDate(dateInput)||(/\b(ontem|anteontem|hoje|amanha|amanhã)\b/i.test(dateInput)?naturalDate(dateInput):null);
      if(!iso)errors.push("Data inválida: "+piece);else put("date",iso);
    }else{
      errors.push("Não entendi: "+piece);
    }
  }
  return{patch,fields,errors};
};
/* V162_CORRECTION_HELPERS_END */

const conversationalChoice=(raw:string,step:"TX_CONFIRM"|"TX_SETTLE"|"TR_CONFIRM")=>{
 const v=N(String(raw||"")).replace(/[.!?]+$/g,"").replace(/\s+/g," ").trim();
 const yes=new Set(["1","sim","isso","isso mesmo","correto","confirmo","confirmar","confirma","pode","pode sim","pode confirmar","pode registrar","ta certo","esta certo","certinho","ok","beleza","fechado"]);
 const correct=new Set(["2","nao","corrigir","corrige","quero corrigir","alterar","mudar","tem erro","errado"]);
 const settle=new Set(["1","efetivar","efetiva","pode efetivar","efetive","confirmar pagamento","ja paguei","ja recebi","foi pago","foi recebido"]);
 const pending=new Set(["2","pendente","deixa pendente","deixar pendente","manter pendente","mantem pendente","nao efetivar","depois","mais tarde","ainda nao"]);
 const cancel=new Set(["2","nao","cancelar transferencia","nao transfere"]);
 if(step==="TX_CONFIRM")return yes.has(v)?"confirm":(correct.has(v)||/^(?:(?:quero|preciso|pode|vamos)\s+)?(?:corrigir|corrige|alterar|mudar|trocar|editar|ajustar)\b/.test(v))?"correct":null;
 if(step==="TX_SETTLE")return settle.has(v)?"settle":pending.has(v)?"pending":null;
 return yes.has(v)?"confirm":cancel.has(v)?"cancel":null;
};
const voiceRegistered=(kind:string,seed:string)=>voicePick(seed,"registered",kind==="income"?["✅ *Receita registrada como pendente!*","✅ *Certo! Receita salva como pendente.*","✅ *Anotei a receita como pendente.*","✅ *Receita lançada! Ainda está pendente.*"]:["✅ *Despesa registrada como pendente!*","✅ *Certo! Despesa salva como pendente.*","✅ *Anotei a despesa como pendente.*","✅ *Despesa lançada! Ainda está pendente.*"]);

const day=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const monthNames=["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

/* V168_FINANCIAL_DATE_HELPERS_START - funcoes puras; nenhuma gravacao ou RPC */
const botCivilDay=(year:number,month:number,dayNumber:number):string|null=>{
  if(!Number.isInteger(year)||!Number.isInteger(month)||!Number.isInteger(dayNumber)||year<2000||year>2099||month<1||month>12||dayNumber<1||dayNumber>31)return null;
  const probe=new Date(Date.UTC(year,month-1,dayNumber,12));
  if(probe.getUTCFullYear()!==year||probe.getUTCMonth()!==month-1||probe.getUTCDate()!==dayNumber)return null;
  return `${year}-${String(month).padStart(2,"0")}-${String(dayNumber).padStart(2,"0")}`;
};
const botShiftCivil=(civil:string,delta:number):string=>{
  const [year,month,dayNumber]=civil.split("-").map(Number);
  if(!botCivilDay(year,month,dayNumber))throw Error("Data de referencia invalida");
  return new Date(Date.UTC(year,month-1,dayNumber+delta,12)).toISOString().slice(0,10);
};
const botParseReceivableDueDate=(raw:string,reference:string=day()):{ok:boolean;due:string|null}=>{
  const value=N(String(raw||"")).replace(/\s+/g," ").trim();
  if(/^(sem data|sem vencimento|sem prazo|nenhum|nao tem vencimento)$/.test(value))return{ok:true,due:null};
  const relative:{[key:string]:number}={hoje:0,amanha:1,ontem:-1,anteontem:-2};
  if(Object.prototype.hasOwnProperty.call(relative,value))return{ok:true,due:botShiftCivil(reference,relative[value])};
  const iso=value.match(/^(20\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])$/);
  if(iso){const due=botCivilDay(Number(iso[1]),Number(iso[2]),Number(iso[3]));return{ok:!!due,due};}
  const match=value.match(/^([0-3]?\d)[\/-]([01]?\d)(?:[\/-](\d{2}|\d{4}))?$/);
  if(!match)return{ok:false,due:null};
  const year=match[3]?Number(match[3].length===2?"20"+match[3]:match[3]):Number(reference.slice(0,4));
  const due=botCivilDay(year,Number(match[2]),Number(match[1]));
  return{ok:!!due,due};
};
const botNextMonthlyDueCivil=(billingDay:number,reference:string=day()):string=>{
  if(!Number.isInteger(billingDay)||billingDay<1||billingDay>31)throw Error("Dia mensal invalido");
  const [year,month,date]=reference.split("-").map(Number);
  if(!botCivilDay(year,month,date))throw Error("Data de referencia invalida");
  for(let shift=0;shift<=2;shift++){
    const monthDate=new Date(Date.UTC(year,month-1+shift,1,12));
    const yy=monthDate.getUTCFullYear(),mm=monthDate.getUTCMonth()+1;
    const lastDay=new Date(Date.UTC(yy,mm,0,12)).getUTCDate();
    const candidate=botCivilDay(yy,mm,Math.min(billingDay,lastDay))!;
    if(candidate>=reference)return candidate;
  }
  throw Error("Vencimento nao encontrado");
};
/* V168_FINANCIAL_DATE_HELPERS_END */

const monthAliases:any={jan:1,janeiro:1,fev:2,fevereiro:2,mar:3,marco:3,abril:4,abr:4,maio:5,mai:5,jun:6,junho:6,jul:7,julho:7,ago:8,agosto:8,set:9,setembro:9,out:10,outubro:10,nov:11,novembro:11,dez:12,dezembro:12};
const pendingPeriod=(s:string)=>{const n=N(s),today=day(),cy=Number(today.slice(0,4)),cm=Number(today.slice(5,7));let y=cy,m=cm,found=false;const iso=n.match(/\b(20\d{2})[-\/](0?[1-9]|1[0-2])\b/);if(iso){y=Number(iso[1]);m=Number(iso[2]);found=true}else{const num=n.match(/\b(0?[1-9]|1[0-2])\s*[\/\-]\s*(\d{2}|20\d{2})\b/);if(num){m=Number(num[1]);y=Number(num[2].length===2?"20"+num[2]:num[2]);found=true}else{for(const [k,v] of Object.entries(monthAliases)){if(new RegExp("\\b"+k+"\\b").test(n)){m=Number(v);found=true;const ym=n.match(/\b(20\d{2})\b/);if(ym)y=Number(ym[1]);break}}if(!found){const only=n.match(/(?:pendencias|pendentes).*?\b(0?[1-9]|1[0-2])\b/);if(only){m=Number(only[1]);found=true}}}}const start=`${y}-${String(m).padStart(2,"0")}-01`;const endDate=new Date(Date.UTC(y,m,0));const end=`${y}-${String(m).padStart(2,"0")}-${String(endDate.getUTCDate()).padStart(2,"0")}`;const label=`${monthNames[m-1].charAt(0).toUpperCase()+monthNames[m-1].slice(1)}/${y}`;return{year:y,month:m,start,end,label,explicit:found}};
const pendingFilters=(s:string)=>{const n=N(s);return{type:/\b(receitas?|entradas?)\b/.test(n)?"income":/\b(despesas?|gastos?|saidas?)\b/.test(n)?"expense":null,context:/\b(empresa|dfl|empresarial)\b/.test(n)?"dfl":/\b(pessoal|personal)\b/.test(n)?"personal":null}};
const amount=(s:string)=>{const m=s.match(/(?:r[$][ ]*)?([0-9]+(?:[.][0-9]{3})*(?:,[0-9]{1,2})?|[0-9]+(?:[.][0-9]{1,2})?)/i);if(!m)return null;const raw=m[1];const normalized=raw.includes(",")?raw.split(".").join("").replace(",","."):raw;const x=Number(normalized);return Number.isFinite(x)&&x>0?x:null};
const typeOf=(s:string)=>/\b(recebi|recebido|receita|entrada|registrar receita|registrar uma receita|entrou|ganhei|vendi|venda|vendas|salario|faturei|pix recebido)\b/.test(N(s))?"income":/\b(gastei|paguei|comprei|despesa|registrar despesa|registrar uma despesa|gasto|saiu|debito|debitei|pago)\b/.test(N(s))?"expense":null;
const explicitCategory=(s:string)=>{const m=s.match(/(?:categoria|categorizar(?:\s+como)?|coloca(?:r)?\s+(?:na|em)\s+categoria)\s*[:=-]?\s*["']?([^,;\n]+?)["']?(?=\s+(?:no|na|pela|pelo|conta|cartao|cartão|empresa|pessoal|hoje|ontem|amanha|amanhã|todo|toda|mensal|semanal|quinzenal)\b|$)/i);return m?.[1]?.trim()||null};
const explicitContext=(s:string)=>{const n=N(s);if(/\b(empresa|empresarial|dfl|da familia)\b/.test(n))return"dfl";if(/\b(pessoal|personal)\b/.test(n))return"personal";return null};
const explicitAccount=(s:string)=>{const strong=s.match(/(?:pela|pelo|conta)\s+(?:conta\s+)?["\']?([^,;\n]+?)["\']?(?=\s+(?:categoria|empresa|pessoal|hoje|ontem|amanha|amanhã|todo|toda|mensal|semanal|quinzenal)\b|$)/i);if(strong?.[1])return strong[1].trim();const trailing=s.match(/\bem\s+["\']?([^,;\n]+?)["\']?(?=\s+(?:empresa|pessoal|hoje|ontem|amanha|amanhã|categoria)\b|$)/i);return trailing?.[1]?.trim()||null};
const hint=(s:string,ty:string|null=null)=>{const n=N(s),h:Array<[RegExp,string]>=[[/mercado|supermercado|atacadao|atacado/,"Supermercado"],[/gasolina|combustivel|posto/,"Gasolina"],[/uber|\b99\b|taxi/,"Uber/99"],[/farmacia|remedio|medicamento/,"Farmácia"],[/ifood/,ty==="income"?"Vendas {IFOOD}":"Delivery"],[/delivery|lanche|restaurante/,"Delivery"],[/internet|wifi|fibra/,"Internet"],[/energia|cemig|luz/,"Energia"],[/aluguel/,"Aluguel"],[/salario/,"Salário"],[/venda|vendi|faturei/,"Vendas"],[/fornecedor/,"Fornecedores"],[/imposto|das|simples/,"Impostos"]];return h.find(([r])=>r.test(n))?.[1]||null};
const recur=(s:string)=>{const n=N(s);if(/toda semana|semanalmente|\bsemanal\b/.test(n))return{frequency:"weekly",occurrences:52,label:"semanal"};if(/quinzenal|a cada 15 dias|de 15 em 15/.test(n))return{frequency:"biweekly",occurrences:26,label:"quinzenal"};if(/a cada 2 meses|bimestral/.test(n))return{frequency:"bimonthly",occurrences:6,label:"bimestral"};if(/todo mes|mensalmente|\bmensal\b|por mes/.test(n))return{frequency:"monthly",occurrences:12,label:"mensal"};return null};
const subInfo=(s:string)=>{const n=N(s);if(!/\b(assinatura|assino|assinei|subscription)\b/.test(n))return null;return{cycle:/semanal/.test(n)?"weekly":/trimestral/.test(n)?"quarterly":/semestral/.test(n)?"semiannually":/anual/.test(n)?"yearly":"monthly"}};
const transfer=(s:string)=>/\b(transfere|transferir|transferi|transferencia)\b/.test(N(s));
const naturalDate=(s:string)=>{const n=N(s),d=new Date(),fmt=(x:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(x);if(/\banteontem\b/.test(n)){d.setDate(d.getDate()-2);return fmt(d)}if(/\bontem\b/.test(n)){d.setDate(d.getDate()-1);return fmt(d)}if(/\bamanha\b/.test(n)){d.setDate(d.getDate()+1);return fmt(d)}return day()};
const explicitDate=(s:string)=>{const m=s.match(/\b(0?[1-9]|[12]\d|3[01])[\/-](0?[1-9]|1[0-2])(?:[\/-](\d{2}|\d{4}))?\b/);if(!m)return null;const yy=m[3]?Number(m[3].length===2?"20"+m[3]:m[3]):Number(day().slice(0,4)),mm=Number(m[2]),dd=Number(m[1]),x=new Date(Date.UTC(yy,mm-1,dd,12));if(x.getUTCFullYear()!==yy||x.getUTCMonth()!==mm-1||x.getUTCDate()!==dd)return null;return `${yy}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`};
const brDate=(v:string|null|undefined)=>{if(!v)return "";const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(v)};
const cleanDescription=(s:string,ty:string,acc:string|null,ctx:string|null,cat:string|null)=>{let x=s.trim();x=x.replace(/\b(?:0?[1-9]|[12]\d|3[01])[\/-](?:0?[1-9]|1[0-2])(?:[\/-](?:\d{2}|\d{4}))?\b/g," ");x=x.replace(/(?:r\$\s*)?\d+(?:[.]\d{3})*(?:,\d{1,2})?/gi," ");x=x.replace(/\b(recebi|recebido|entrou|ganhei|faturei|vendi|venda|gastei|paguei|comprei|despesa|gasto|saiu|debito|debitei|pago)\b/gi," ");x=x.replace(/\b(hoje|ontem|anteontem|amanha|amanhã)\b/gi," ");if(acc){const q=acc.replace(/[.*+?^$()|[\]{}\\]/g,"\\$&");x=x.replace(new RegExp("\\b(?:pela|pelo|conta|em)\\s+(?:conta\\s+)?"+q+"\\b","i")," ")}if(ctx)x=x.replace(/\b(empresa|empresarial|dfl|da familia|pessoal|personal)\b/gi," ");if(cat){const q=cat.replace(/[.*+?^$()|[\]{}\\]/g,"\\$&");x=x.replace(new RegExp("\\b(?:categoria|categorizar(?:\\s+como)?|na categoria|em categoria)\\s*[:=-]?\\s*"+q+"\\b","i")," ")}x=x.replace(/\s+/g," ").trim().replace(/^[,;:\- ]+|[,;:\- ]+$/g,"");x=x.replace(/^(?:de|do|da|em|no|na|para|pra|pela|pelo)\s+/i,"").trim();x=x.replace(/\s+(?:pela|pelo|na conta|no cartão|no cartao|na conta)\s+.+$/i,"").trim();if(cat){const parts=x.split(/\s+/);if(parts.length>1&&N(parts[0])===N(cat))x=parts.slice(1).join(" ")}x=x.replace(/[{}\[\]]/g," ").replace(/\s+/g," ").trim().replace(/\s+\b(?:na|no|em|conta)\b\s*$/i,"").trim();if(!x)return ty==="income"?"Receita":"Despesa";return x.charAt(0).toUpperCase()+x.slice(1)};
const merchantKey=(s:string)=>N(s).replace(/r?\$?\s*\d+[\d.,]*/g," ").replace(/\b(recebi|recebido|entrou|ganhei|vendi|venda|faturei|paguei|gastei|comprei|despesa|gasto|categoria|conta|empresa|pessoal|hoje|ontem|anteontem|amanha|em|na|no|de|do|da|pela|pelo)\b/g," ").replace(/\s+/g," ").trim().split(" ").filter(x=>x.length>2).slice(0,3).join(" ");
const allAccs=async(u:string)=>{const r=await db.from("accounts").select("id,name,balance,context").eq("user_id",u).eq("is_archived",false).order("name");return r.data||[]};
async function learnCategory(u:string,description:string,categoryId:string|null){const key=merchantKey(description);if(!key||!categoryId)return;const q=await db.from("categorization_rules").select("id").eq("user_id",u).eq("match_text",key).maybeSingle();if(q.data)await db.from("categorization_rules").update({category_id:categoryId,confidence:1,last_used_at:new Date().toISOString()}).eq("id",q.data.id);else await db.from("categorization_rules").insert({user_id:u,match_text:key,category_id:categoryId,confidence:1,last_used_at:new Date().toISOString()})}
async function uid(seed:string){const h=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(seed))),d=h.slice(0,16);d[6]=(d[6]&15)|80;d[8]=(d[8]&63)|128;const x=[...d].map(b=>b.toString(16).padStart(2,"0")).join("");return`${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20)}`}
async function userFor(x:string){let r=await db.from("user_phones").select("user_id,phone,phone_id,name").eq("phone",x).maybeSingle();if(r.data)return r.data;r=await db.from("user_phones").select("user_id,phone,phone_id,name").eq("phone_id",x).maybeSingle();return r.data}
async function send(to:string,text:string){const r=await fetch(`${Deno.env.get("EVOLUTION_API_URL")}/message/sendText/${Deno.env.get("EVOLUTION_INSTANCE")}`,{method:"POST",headers:{"Content-Type":"application/json",apikey:Deno.env.get("EVOLUTION_API_KEY")!},body:JSON.stringify({number:to,textMessage:{text}})});if(!r.ok)throw Error(`Evolution ${r.status}`);return text}
async function save(phone:string,step:string,temp_data:any){const{error}=await db.from("bot_sessions").upsert({phone,step,temp_data},{onConflict:"phone"});if(error)throw error}
/* V157: lifecycle seguro de comprovante mantido temporariamente na sessão. */
const cleanupHeldReceipt=async(path?:string|null)=>{
 if(!path)return;
 try{
  const linked=await db.from("transactions").select("id").eq("receipt_url",path).limit(1);
  if(linked.error)throw linked.error;
  if((linked.data||[]).length)return;
  const removed=await db.storage.from("receipts").remove([path]);
  if(removed.error)throw removed.error;
  console.log("[V157_HELD_RECEIPT_CLEANED]",JSON.stringify({path}));
 }catch(e){
  console.error("[V157_HELD_RECEIPT_CLEANUP_ERROR]",JSON.stringify({path,error:String(e)}));
 }
};
const clear=async(p:string)=>{
 const current=await db.from("bot_sessions").select("temp_data").eq("phone",p).maybeSingle();
 if(current.error)throw current.error;
 const held=current.data?.temp_data?.held_receipt_path;
 if(held)await cleanupHeldReceipt(String(held));
 return db.from("bot_sessions").delete().eq("phone",p);
};
async function audit(u:string,f:string,t:string,k:string){const e=await db.from("whatsapp_messages").select("id,status").eq("provider_message_id",k).maybeSingle();if(e.data&&e.data.status!=="error")return null;if(e.data){await db.from("whatsapp_messages").update({status:"processing",message_text:t}).eq("id",e.data.id);return e.data.id}const r=await db.from("whatsapp_messages").insert({user_id:u,from_number:f,message_text:t,message_type:"text",status:"processing",provider_message_id:k}).select("id").single();if(r.error)throw r.error;return r.data.id}
const done=(id:string|null,status:string,response_text:string,extracted_json:any=null,transaction_id:string|null=null)=>id?db.from("whatsapp_messages").update({status,response_text,extracted_json,transaction_id,processed_at:new Date().toISOString()}).eq("id",id):Promise.resolve();
async function accs(u:string,c:string){const r=await db.from("accounts").select("id,name,balance,context").eq("user_id",u).eq("context",c).eq("is_archived",false).order("name");return r.data||[]}
async function cats(u:string,c:string,t:string){const r=await db.from("categories").select("id,name,icon,color").eq("user_id",u).eq("context",c).eq("type",t).order("name");return r.data||[]}
function matchNamed(list:any[],name:string|null){if(!name)return null;const n=N(name);return list.find(x=>N(x.name)===n)||list.find(x=>N(x.name).includes(n)||n.includes(N(x.name)))||null}
function pickNamed(list:any[],answer:string){const raw=String(answer||"").trim(),i=Number(raw)-1;if(/^\d+$/.test(raw)&&Number.isInteger(i)&&i>=0&&i<list.length)return list[i];return matchNamed(list,raw)}
function accountToken(s:string){return N(s).replace(/[^a-z0-9]+/g,"")}
function accountAliases(name:string){
  const base=accountToken(name),out=new Set<string>([base]);
  if(base==="infinitepay"||base==="infinitpay"||base==="infinitypay"){
    out.add("infinitepay");out.add("infinitpay");out.add("infinitypay")
  }
  return [...out].filter(x=>x.length>=4)
}
function accountsInText(list:any[],text:string){
  const compact=accountToken(text),hits=list.filter((a:any)=>
    accountAliases(String(a.name||"")).some(alias=>compact.includes(alias))
  );
  if(!hits.length)return{account:null,ambiguous:false,matches:[]};
  const ids=new Set(hits.map((x:any)=>x.id));
  if(ids.size===1)return{account:hits[0],ambiguous:false,matches:hits};
  const contexts=new Set(hits.map((x:any)=>x.context));
  return{account:null,ambiguous:true,matches:hits,contexts:[...contexts]}
}
function stripMatchedAccount(description:string,account:any){
  if(!account?.name)return description;
  let x=description;
  for(const alias of accountAliases(account.name)){
    const variants=alias==="infinitepay"
      ?["InfinitePay","InfinitPay","InfinityPay"]
      :[account.name];
    for(const v of variants){
      const q=String(v).replace(/[.*+?^$()|[\]{}\\]/g,"\\$&");
      x=x.replace(
        new RegExp("\\s+(?:na|no|em|pela|pelo|conta)\\s+(?:conta\\s+)?"+q+"\\b.*$","i"),
        ""
      ).trim()
    }
  }
  return x||description
}
function conversationalContext(answer:string){const n=N(answer);if(n==="1"||/^(empresa|dfl|empresarial)$/.test(n))return"dfl";if(n==="2"||/^(pessoal|personal)$/.test(n))return"personal";return null}
function list(items:any[],title:string,showBalance=false){let s=title+"\n\n";items.forEach((x,i)=>s+=`*${i+1}* — *${x.name}*${showBalance?`\n   💰 *${money(x.balance)}*`:""}\n`);return s}
async function resolveAccount(u:string,context:string,wanted:string|null){const a=await accs(u,context);return{all:a,found:matchNamed(a,wanted)}}
async function categoryStep(u:any,phone:string,sd:any,acc:any,reply:any,aid:string){
  const all=await cats(u.user_id,sd.context,sd.type),wanted=sd.category_explicit||sd.category_hint,found=matchNamed(all,wanted);
  if(found)return{category:found};
  const mk=merchantKey(sd.description||"");
  if(mk){
    const lr=await db.from("categorization_rules").select("category_id,confidence").eq("user_id",u.user_id).eq("match_text",mk).maybeSingle();
    const learned=lr.data?all.find((x:any)=>x.id===lr.data.category_id):null;
    if(learned&&Number(lr.data.confidence||0)>=0.8)return{category:learned,learned:true};
  }
  const hist=await db.from("transactions").select("category_id,description,account_id").eq("user_id",u.user_id).eq("context",sd.context).eq("type",sd.type).not("category_id","is",null).order("date",{ascending:false}).limit(250);
  const score=new Map<string,number>(),key=N(sd.description||"");
  (hist.data||[]).forEach((x:any)=>{
    let weight=1;
    if(acc?.id&&x.account_id===acc.id)weight+=2;
    const hd=N(x.description||"");
    if(key&&hd&&(hd.includes(key)||key.includes(hd)))weight+=4;
    score.set(x.category_id,(score.get(x.category_id)||0)+weight);
  });
  const ranked=[...all].sort((a:any,b:any)=>(score.get(b.id)||0)-(score.get(a.id)||0)||a.name.localeCompare(b.name));
  const top=ranked[0],second=ranked[1],topScore=top?(score.get(top.id)||0):0,secondScore=second?(score.get(second.id)||0):0;
  if(top&&topScore>=6&&topScore>=secondScore+3)return{category:top,historical:true};
  const primary=ranked.slice(0,5);
  await save(phone,"TX_CAT",{...sd,account:acc,categories:primary,all_categories:ranked});
  const reason=sd.category_explicit
    ?`Não encontrei *${sd.category_explicit}*. Qual categoria você quer usar?`
    :`Só fiquei em dúvida na categoria de *${sd.description||"este lançamento"}*.`;
  let menu=list(primary,"Qual combina melhor?");
  if(ranked.length>primary.length)menu+=`\n*${primary.length+1}* — Ver outras categorias`;
  const out=await reply(`${reason}\n\n${menu}\n\n_Você pode responder pelo nome. Vou lembrar da escolha._`);
  await done(aid,"extracted",out,{...sd,category_selection:true});
  return{pending:true}
}
async function recordTx(u:any,phone:string,sd:any,acc:any,cat:any,reply:any,aid:string){const key=await uid(`whatsapp:${sd.provider_message_id}`),rpc=sd.recurrence?"bot_record_recurring_transactions":"bot_record_transaction",params=sd.recurrence?{p_user_id:u.user_id,p_account_id:acc.id,p_type:sd.type,p_amount:Number(sd.amount),p_description:sd.description,p_context:sd.context,p_category_id:cat?.id||null,p_idempotency_key:key,p_start_date:sd.date||day(),p_frequency:sd.recurrence.frequency,p_occurrences:sd.recurrence.occurrences,p_custom_interval_months:1}:{p_user_id:u.user_id,p_account_id:acc.id,p_type:sd.type,p_amount:Number(sd.amount),p_description:sd.description,p_context:sd.context,p_category_id:cat?.id||null,p_idempotency_key:key,p_date:sd.date||day()};const r=await db.rpc(rpc,params);if(r.error)throw r.error;const txid=r.data?.transaction_id||null;let heldReceiptLinked=false;if(!sd.recurrence&&txid&&sd.held_receipt_path){const tu=await db.from("transactions").update({receipt_url:sd.held_receipt_path}).eq("id",txid).eq("user_id",u.user_id).is("receipt_url",null).select("id").maybeSingle();if(tu.error)throw tu.error;heldReceiptLinked=!!tu.data;if(heldReceiptLinked&&sd.held_receipt_message_id)await db.from("whatsapp_messages").update({transaction_id:txid,extracted_json:{action:"media.linked_after_transaction_create",storage_bucket:"receipts",storage_path:sd.held_receipt_path,transaction_id:txid},processed_at:new Date().toISOString()}).eq("id",sd.held_receipt_message_id)}if(!sd.recurrence&&txid)await save(phone,"TX_SETTLE",{transaction_id:txid,type:sd.type,amount:sd.amount,account:acc,category:cat,receipt_attached:heldReceiptLinked});else await clear(phone);const out=await reply(`${sd.recurrence?`✅ *${sd.type==="income"?"Receita":"Despesa"} recorrente registrada como pendente!*`:voiceRegistered(sd.type,sd.provider_message_id||aid)}\n\n💰 *${money(sd.amount)}*\n📝 ${sd.description}\n🏦 *${acc.name}*\n🏷️ *${cat?.name||"Sem categoria"}*${sd.recurrence?`\n🔁 ${sd.recurrence.label} · ${sd.recurrence.occurrences} ocorrências`:`\n\n*Deseja efetivar agora?*\n*1* — Efetivar e atualizar saldo\n*2* — Manter pendente\n\n${heldReceiptLinked?"📎 *Comprovante já anexado automaticamente.*":"📎 *Se quiser, pode enviar uma foto ou PDF do comprovante antes de decidir.*"}`}`);await done(sd.audit_message_id,"inserted",out,{...sd,category_id:cat?.id,rpc:r.data},r.data?.transaction_id||null);await done(aid,"extracted",out)}
async function afterConfirm(u:any,phone:string,sd:any,reply:any,aid:string){
  const aa=await allAccs(u.user_id);
  let found=sd.account||matchNamed(aa,sd.account_explicit);
  if(found){
    const next={...sd,context:found.context,account_explicit:found.name,account:found};
    const cr=await categoryStep(u,phone,next,found,reply,aid);
    if(!cr.pending)await recordTx(u,phone,next,found,cr.category,reply,aid);
    return;
  }
  if(!sd.context){
    await save(phone,"TX_CTX",sd);
    const ambiguous=sd.account_ambiguous===true;
    const o=await reply(ambiguous
      ?"Encontrei essa conta em mais de um contexto. É *Empresa* ou *Pessoal*?"
      :"Só preciso saber onde esse lançamento pertence: *Empresa* ou *Pessoal*?");
    await done(aid,"extracted",o,{action:ambiguous?"clarify.account_context":"clarify.context"});
    return;
  }
  const ar=await resolveAccount(u.user_id,sd.context,sd.account_explicit);
  if(sd.account_explicit&&ar.found){
    const next={...sd,account:ar.found,context:ar.found.context||sd.context};
    const cr=await categoryStep(u,phone,next,ar.found,reply,aid);
    if(!cr.pending)await recordTx(u,phone,next,ar.found,cr.category,reply,aid);
    return;
  }
  if(ar.all.length===1&&!sd.account_explicit){
    const next={...sd,account:ar.all[0],context:ar.all[0].context||sd.context};
    const cr=await categoryStep(u,phone,next,ar.all[0],reply,aid);
    if(!cr.pending)await recordTx(u,phone,next,ar.all[0],cr.category,reply,aid);
    return;
  }
  await save(phone,"TX_ACC",{...sd,accounts:ar.all});
  const prefix=sd.account_explicit?`Não encontrei *${sd.account_explicit}* nesse contexto.\n\n`:"";
  const o=await reply(prefix+list(ar.all,"Qual conta recebeu/pagou?",true)+"\n\n_Você pode responder pelo nome da conta._");
  await done(aid,"extracted",o)
}
serve(async req=>{
if(req.method!=="POST")return new Response("Method not allowed",{status:405});
let p:any;
try{p=await readBoundedJson(req)}catch{return new Response("Invalid request",{status:400})}
if(!trustedWebhook(req,p,Deno.env.get("DFL_WEBHOOK_SECRET"),Deno.env.get("EVOLUTION_API_KEY")))return new Response("Unauthorized",{status:401});
try{if(p.event!=="messages.upsert")return new Response("OK");const raw=String(p.data?.key?.remoteJid||"");if(!raw||raw.includes("@g.us"))return new Response("OK");const sender=raw.split("@")[0],u=await userFor(sender);if(!u)return new Response("OK");const fromMe=!!p.data?.key?.fromMe;if(fromMe&&sender!==String(u.phone_id||"")&&sender!==String(u.phone||""))return new Response("OK");let text=String(p.data?.message?.conversation||p.data?.message?.extendedTextMessage?.text||"").trim();
if(!text){
  const m=p.data?.message||{}, media=m.imageMessage||m.documentMessage||null;
  if(media){
    const kind=m.imageMessage?"image":"document", mime=String(media.mimetype||"").toLowerCase();
    const allowed=(kind==="image"&&["image/jpeg","image/png","image/webp"].includes(mime))||(kind==="document"&&mime==="application/pdf");
    const declared=Number(media.fileLength||0), max=10*1024*1024;
    const k=String(p.data?.key?.id||`${sender}:${p.data?.messageTimestamp||0}:media`);
    if(!allowed||!declared||declared>max){console.warn("[V95B_MEDIA_REJECT]",JSON.stringify({kind,mime,declared}));return new Response("OK")}
    const existing=await db.from("whatsapp_messages").select("id,status,media_url").eq("provider_message_id",k).eq("user_id",u.user_id).maybeSingle();
    if(existing.data?.media_url)return new Response("OK");
    let aid=existing.data?.id||null;
    if(!aid){
      const ins=await db.from("whatsapp_messages").insert({user_id:u.user_id,from_number:sender,message_text:String(media.caption||"").slice(0,500),message_type:kind,status:"processing",provider_message_id:k}).select("id").single();
      if(ins.error)throw ins.error; aid=ins.data.id
    }
    const sr=await db.from("bot_sessions").select("step,temp_data").eq("phone",u.phone).maybeSingle();
    const financialSteps=new Set(["TX_AMOUNT","TX_CONFIRM","TX_CORRECT","TX_CTX","TX_ACC","TX_CAT","TX_CAT_ALL","TX_SETTLE"]);
    const sessionStep=String(sr.data?.step||""), sessionData=sr.data?.temp_data||{};
    const pendingTx=sessionStep==="TX_SETTLE"&&sessionData?.transaction_id?String(sessionData.transaction_id):null;
    const canHoldReceipt=financialSteps.has(sessionStep)&&!pendingTx;
    if(!pendingTx&&!canHoldReceipt){
      await db.from("whatsapp_messages").update({status:"ignored",media_url:null,transaction_id:null,
        extracted_json:{action:"media.ignored_no_financial_context",kind,mimetype:mime,size:declared},processed_at:new Date().toISOString()}).eq("id",aid);
      console.log("[V156_MEDIA_IGNORED_NO_FINANCIAL_CONTEXT]",JSON.stringify({kind,mimetype:mime,size:declared}));
      return new Response("OK")
    }
    if(pendingTx){
      const target=await db.from("transactions").select("id,receipt_url").eq("id",pendingTx).eq("user_id",u.user_id).maybeSingle();
      if(target.error)throw target.error;
      if(!target.data||target.data.receipt_url){
        await db.from("whatsapp_messages").update({status:"ignored",media_url:null,transaction_id:null,
          extracted_json:{action:"media.ignored_invalid_destination"},processed_at:new Date().toISOString()}).eq("id",aid);
        return new Response("OK")
      }
    }
    const evo=await fetch(`${Deno.env.get("EVOLUTION_API_URL")}/chat/getBase64FromMediaMessage/${Deno.env.get("EVOLUTION_INSTANCE")}`,{method:"POST",headers:{"Content-Type":"application/json",apikey:Deno.env.get("EVOLUTION_API_KEY")!},body:JSON.stringify({message:p.data,convertToMp4:false})});
    if(!evo.ok){const detail=(await evo.text()).slice(0,300);await db.from("whatsapp_messages").update({status:"error",response_text:`Evolution media ${evo.status}`}).eq("id",aid);console.error("[V95B_MEDIA_FETCH]",evo.status,detail);return new Response("OK")}
    const ej=await evo.json(), b64=String(ej?.base64||"").replace(/^data:[^;]+;base64,/,"");
    if(!b64)throw Error("Evolution media response without base64");
    const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
    if(!bin.length||bin.length>max)throw Error("Invalid media size");
    const outMime=String(ej?.mimetype||mime).toLowerCase();
    if(!receiptMimeMatches(bin,outMime))throw Error("Receipt content does not match its media type");
    const ext=outMime==="application/pdf"?"pdf":outMime==="image/png"?"png":outMime==="image/webp"?"webp":"jpg";
    const path=`${u.user_id}/whatsapp/${k.replace(/[^a-zA-Z0-9._-]/g,"_")}.${ext}`;
    const up=await db.storage.from("receipts").upload(path,bin,{contentType:outMime,cacheControl:"3600",upsert:false});
    if(up.error&&!String(up.error.message||"").toLowerCase().includes("already"))throw up.error;


    if(canHoldReceipt){
      const previousHeld=sessionData?.held_receipt_path?String(sessionData.held_receipt_path):null;
      if(previousHeld&&previousHeld!==path){
        await cleanupHeldReceipt(previousHeld);
        if(sessionData?.held_receipt_message_id){
          await db.from("whatsapp_messages").update({
            media_url:null,
            extracted_json:{action:"media.held_receipt_replaced",replaced_storage_path:previousHeld},
            processed_at:new Date().toISOString()
          }).eq("id",String(sessionData.held_receipt_message_id));
        }
        console.log("[V157_HELD_RECEIPT_REPLACED]",JSON.stringify({previous:previousHeld,current:path}));
      }
      await save(u.phone,sessionStep,{...sessionData,held_receipt_path:path,held_receipt_mime:outMime,held_receipt_message_id:aid});
      await db.from("whatsapp_messages").update({status:"extracted",media_url:path,transaction_id:null,
        extracted_json:{action:"media.held_for_active_transaction",kind,mimetype:outMime,size:bin.length,storage_bucket:"receipts",storage_path:path,session_step:sessionStep},
        processed_at:new Date().toISOString()}).eq("id",aid);
      await send(u.phone,"📎 *Comprovante recebido.*\n\nVou vincular este arquivo automaticamente ao lançamento que estamos preenchendo.");
      console.log("[V156_RECEIPT_HELD]",JSON.stringify({kind,mimetype:outMime,size:bin.length,step:sessionStep}));
      return new Response("OK")
    }

    let linked=false;
    if(pendingTx){
      const tq=await db.from("transactions").select("id,receipt_url").eq("id",pendingTx).eq("user_id",u.user_id).maybeSingle();
      if(tq.error)throw tq.error;
      if(tq.data?.receipt_url===path)linked=true;
      else if(tq.data&&!tq.data.receipt_url){
        const tu=await db.from("transactions").update({receipt_url:path}).eq("id",pendingTx).eq("user_id",u.user_id).is("receipt_url",null).select("id").maybeSingle();
        if(tu.error)throw tu.error; linked=!!tu.data;
        if(!linked){const already=await db.from("transactions").select("receipt_url").eq("id",pendingTx).eq("user_id",u.user_id).maybeSingle();if(already.error)throw already.error;linked=already.data?.receipt_url===path}
      }
    }
    if(!linked){
      // Destination changed after preflight. Do not retain a financial receipt
      // for a known failed link. A DB/network error takes the retry path above.
      const reference=await db.from("transactions").select("id").eq("user_id",u.user_id).eq("receipt_url",path).limit(1).maybeSingle();
      if(reference.error)throw reference.error;
      if(!reference.data){const cleanup=await db.storage.from("receipts").remove([path]);if(cleanup.error)throw cleanup.error;}
      await db.from("whatsapp_messages").update({status:"ignored",media_url:null,transaction_id:null,
        extracted_json:{action:"media.ignored_destination_changed"},processed_at:new Date().toISOString()}).eq("id",aid);
      return new Response("OK")
    }
    await db.from("whatsapp_messages").update({status:"extracted",media_url:path,transaction_id:linked?pendingTx:null,extracted_json:{action:linked?"media.linked":"media.stored",kind,mimetype:outMime,size:bin.length,storage_bucket:"receipts",storage_path:path,transaction_id:linked?pendingTx:null},processed_at:new Date().toISOString()}).eq("id",aid);
    await send(u.phone,linked?`📎 *Comprovante anexado à transação.*\n\nO arquivo foi armazenado com segurança e vinculado ao lançamento que está aguardando efetivação.`:`📎 *Anexo recebido com segurança.*\n\n${kind==="image"?"Imagem":"PDF"} armazenado no Finance. Não encontrei uma única transação pendente em edição para vincular automaticamente, então nenhum lançamento ou saldo foi alterado.`);
    console.log("[DFL_RECEIPT_LINKED]",JSON.stringify({kind,mimetype:outMime,size:bin.length}));
  }
  return new Response("OK")
}const phone=u.phone,k=String(p.data?.key?.id||`${sender}:${p.data?.messageTimestamp||0}:${text}`),aid=await audit(u.user_id,sender,text,k);if(!aid)return new Response("OK");let n=N(text);const reply=(s:string)=>send(phone,s);await db.from("user_phones").update({last_interaction:new Date().toISOString()}).eq("user_id",u.user_id).eq("phone",phone);
if(n==="/ping"){const o=await reply("🤖 *DFL Finance Bot operacional.*\n✅ Conectado e pronto para lançamentos, consultas e pendências.");await done(aid,"extracted",o,{command:"ping",self_chat:fromMe});return new Response("OK")}
if(["cancelar","/cancelar","cancela","sair","parar","abortar","esquece","comecar de novo","começar de novo"].includes(n)){await clear(phone);const o=await reply("🚫 Operação cancelada. Pode começar outra quando quiser.");await done(aid,"extracted",o,{action:"session.cancel"});return new Response("OK")}
if(n==="/ajuda"||n==="ajuda"||n==="comandos"||n==="o que voce faz"||n==="o que você faz"||n==="o que consegue fazer"||n==="o que voce consegue fazer"){const o=await reply("🤖 *DFL Finance — Central de Ajuda*\n\n*1* — 💸 Lançamentos, datas, recorrências e comprovantes\n*2* — 🕒 Pendências, filtros e correções\n*3* — 🔄 Transferências\n*4* — 👤 Quem me deve, pagamentos e crédito\n*5* — 🔁 Assinaturas\n*6* — 📊 Consultas, agenda, saldos, períodos e relatórios\n*7* — 🏷️ Categorias e organização\n\n*Atalhos:* /saldo · /resumo · /relatorio · /ritmo · cancelar\n\n*Dicas rápidas:*\n• *agenda financeira* — próximos vencimentos\n• *quem está atrasado* — cobranças vencidas\n• *resumo novembro* — visão mensal\n• *extrato novembro empresa* — lançamentos do período\n• *quanto gastei novembro pessoal* — consulta filtrada\n\n💡 *Você não precisa decorar comandos.* Fale naturalmente. Exemplos:\n• *gastei 45 no posto pela Nubank*\n• *recebi 250 de vendas em Carteira ontem*\n• *pendências despesas novembro*\n• *João pagou 50*\n• *transfere 100 da Carteira para Inter*\n• *quanto gastei novembro empresa*\n• *agenda financeira* / *o que vence nos próximos 15 dias*\n• *quem está atrasado*\n• *corrigir pendência* — escolhe uma pendência e altera só o campo necessário\n\nPara ir direto a um assunto: *ajuda lançamentos*, *ajuda comprovante*, *ajuda pendências*, *ajuda correções*, *ajuda quem me deve*, *ajuda transferências*, *ajuda assinaturas*, *ajuda consultas*, *ajuda agenda* ou *ajuda categorias*.");await save(phone,"HELP_MENU",{});await done(aid,"extracted",o,{action:"help.menu"});return new Response("OK")}
if(/^ajuda\s+/.test(n)){const topic=n.replace(/^ajuda\s+/,"").trim();let msg="";if(/pendencia|corrigir|correcao/.test(topic))msg="🕒 *Pendências e correções*\n\n• *pendências* — mês atual\n• *pendências novembro*\n• *pendências nov/26*\n• *pendências 11/2026*\n• *pendências despesas novembro*\n• *pendências empresa*\n• *pendências pessoal nov/26*\n\nAo revisar uma pendência você pode efetivar, manter ou corrigir valor, descrição, data, conta e categoria. Fale naturalmente: *muda o valor para 35,90*, *foi ontem*, *troca a conta para Nubank*, *muda a categoria para Supermercado* ou *muda a descrição para Mercado*.";else if(/comprov|anexo|foto|pdf/.test(topic))msg="📎 *Comprovantes*\n\nCrie a receita/despesa e, enquanto ela estiver pendente, envie a foto ou PDF. O bot vincula o arquivo à transação sem alterar saldo sozinho. Depois você escolhe efetivar ou manter pendente.";else if(/deve|receber|cobranca/.test(topic))msg="👤 *Quem me deve*\n\n• *João me deve 150*\n• *João me deve 150 vence 15/10*\n• *João pagou 50* / *João pagou 50 ontem* / *João pagou 50 em 03/10*\n• *João vence 20/10* — altera vencimento com confirmação\n• *quanto João me deve?* — consulta o restante aberto\n• *quem me deve?*\n• pagamento parcial ou *quitar*\n• alterar vencimento, nome ou valor total\n• consultar quanto uma pessoa ainda deve\n• listar quem está atrasado\n• pagamento acima do restante é separado em *aplicado à cobrança* + *crédito do contato*\n• saldo da conta só muda depois da confirmação.";else if(/transfer/.test(topic))msg="🔄 *Transferências*\n\nEx.: *transfere 50 da Carteira para Inter*. O bot identifica as contas quando possível, mostra origem/destino, valor, saldos projetados e alerta se a origem ficar negativa antes de confirmar.";else if(/assinatura|recorr/.test(topic))msg="🔁 *Assinaturas e recorrências*\n\n• *criar assinatura*\n• *minhas assinaturas*\n• pausar/retomar\n• alterar valor\n• alterar vencimento\n• cancelar no Finance\n• consultar próximas dos 7 dias\n• lançamentos comuns também podem ser recorrentes (semanal, quinzenal, mensal, bimestral).";else if(/agenda|vencimento/.test(topic))msg="📅 *Agenda financeira*\n\n• *agenda financeira* — próximos 7 dias\n• *o que vence nos próximos 15 dias*\n• *agenda 30 dias empresa*\n• reúne pendências de entrada/saída, assinaturas e valores a receber\n• *quem está atrasado* mostra cobranças vencidas";else if(/consulta|relatorio|saldo/.test(topic))msg="📊 *Consultas e relatórios*\n\n• quanto tenho na InfinitPay?\n• quais contas estão negativas?\n• quanto tenho na empresa?\n• quanto entrou hoje?\n• maiores despesas\n• onde gastei mais esse mês?\n• quanto tenho para receber?\n• assinaturas dos próximos 7 dias\n• como está a empresa hoje?\n• resumo de hoje\n• *resumo novembro* / *resumo nov/26*\n• *extrato novembro*\n• *quanto gastei novembro* / *quanto recebi novembro*\n• combine consultas com *empresa* ou *pessoal*\n• /saldo · /resumo · /relatorio";else if(/categoria|organiza/.test(topic))msg="🏷️ *Categorias e organização*\n\n• *criar categoria*\n• o bot sugere categoria pelo texto\n• aprende associações usadas anteriormente\n• respeita Receita/Despesa e Empresa/Pessoal\n• ao corrigir uma pendência, você também pode trocar a categoria.";else msg="💸 *Lançamentos*\n\n• *gastei 101,31 no Bernardão pela InfinitPay*\n• *recebi 250 de vendas em Carteira*\n• data padrão é hoje\n• use *ontem*, *anteontem* ou uma data explícita quando necessário\n• conta informada pode definir automaticamente Empresa/Pessoal\n• o bot pergunta apenas o que estiver faltando\n• a transação nasce pendente e só altera saldo quando você confirma\n• envie foto/PDF antes de efetivar se quiser anexar comprovante.";const o=await reply(msg+"\n\nDigite *ajuda* para voltar à Central de Ajuda.");await done(aid,"extracted",o,{action:"help.topic",topic});return new Response("OK")}
const sr=await db.from("bot_sessions").select("*").eq("phone",phone).maybeSingle();let s=sr.data;let sd=s?.temp_data||{};
const freshTransactionIntent=/^(?:registrar|nova|novo|criar|cadastrar)\s+(?:uma\s+)?(?:receita|despesa)\b/.test(n);
if(s&&freshTransactionIntent){await clear(phone);s=null;sd={};console.log("[V153_SESSION_RESTART]",JSON.stringify({intent:n.startsWith("registrar receita")?"income":n.startsWith("registrar despesa")?"expense":"transaction"}))}
const financeIntent=/^(?:\/|ajuda\b|cancelar\b|agenda\b|o que vence\b|ritmo\b|planejamento\b|planejar\b|comparar\b|compare\b|comparativo\b|evolucao\b|tendencia\b|pendencias?\b|pendentes?\b|saldo\b|resumo\b|relatorio\b|extrato\b|quanto\b|como esta a empresa\b|quem me deve\b|transf(?:ere|erir|eri|erencia)\b|gastei\b|paguei\b|comprei\b|despesa\b|gasto\b|registrar receita\b|registrar uma receita\b|registrar despesa\b|registrar uma despesa\b|receita\b|entrada\b|recebi\b|recebido\b|entrou\b|ganhei\b|vendi\b|venda\b|faturei\b|pix recebido\b|.+\s+me deve\s+|.+\s+pagou\s+|.+\s+vence\s+)/.test(n);if(!s&&fromMe&&!financeIntent){await done(aid,"ignored","",{action:"ignored.non_finance_self_message"});return new Response("OK")}
if(s?.step==="HELP_MENU"&&/^\d+$/.test(text)===false){const topic=N(text);if(/pendencia|corrigir|correcao/.test(topic)){await clear(phone);const o=await reply("🕒 *Pendências e correções*\n\n• *pendências* — mês atual\n• *pendências novembro* / *nov/26* / *11/2026*\n• combine com *despesas*, *receitas*, *empresa* ou *pessoal*\n• corrija valor, descrição, data, conta ou categoria\n\nEx.: *muda o valor para 35,90*, *foi ontem*, *troca a conta para Nubank*, *muda a categoria para Supermercado*.");await done(aid,"extracted",o,{action:"help.free_topic",topic:"pendencias"});return new Response("OK")}if(/deve|receber|cobranca/.test(topic)){await clear(phone);const o=await reply("👤 *Quem me deve*\n\n• *João me deve 150*\n• *João pagou 50*\n• *João vence 20/10*\n• parcial, quitação e crédito excedente\n• alterar vencimento, nome ou valor total\n• consultar restante e atrasados.");await done(aid,"extracted",o,{action:"help.free_topic",topic:"recebiveis"});return new Response("OK")}if(/comprov|anexo|foto|pdf/.test(topic)){await clear(phone);const o=await reply("📎 *Comprovantes*\n\nEnvie foto ou PDF enquanto a transação estiver pendente. O anexo é vinculado ao lançamento e não altera o saldo sozinho. Depois você escolhe efetivar ou manter pendente.");await done(aid,"extracted",o,{action:"help.free_topic",topic:"comprovantes"});return new Response("OK")}}
if(s?.step==="HELP_MENU"){const topics:any={"1":"lançamentos","2":"pendências","3":"transferências","4":"quem me deve","5":"assinaturas","6":"consultas","7":"categorias"};const topic=topics[text];if(!topic){const o=await reply("Escolha uma opção de *1 a 7* ou digite *cancelar*.");await done(aid,"extracted",o);return new Response("OK")}await clear(phone);let msg="";if(topic==="lançamentos")msg="💸 *Lançamentos e comprovantes*\n\n• *gastei 101,31 no Bernardão pela InfinitPay*\n• *recebi 250 de vendas em Carteira ontem*\n• hoje é a data padrão; você pode informar outra data\n• conta pode definir Empresa/Pessoal automaticamente\n• o lançamento nasce pendente e só mexe no saldo após confirmação\n• envie foto/PDF enquanto estiver pendente para anexar comprovante";else if(topic==="pendências")msg="🕒 *Pendências e correções*\n\n• *pendências* — mês atual\n• *pendências novembro* / *nov/26* / *11/2026*\n• combine com *despesas*, *receitas*, *empresa* ou *pessoal*\n• corrija valor, descrição, data, conta ou categoria antes de efetivar\n• exemplos: *muda o valor para 35,90*, *foi ontem*, *troca a conta para Nubank*";else if(topic==="transferências")msg="🔄 *Transferências*\n\n• *transfere 50 da Carteira para Inter*\n• o bot mostra origem, destino, valor e saldos projetados\n• avisa se a origem ficar negativa\n• a transferência só é executada depois da confirmação";else if(topic==="quem me deve")msg="👤 *Quem me deve*\n\n• *João me deve 150*\n• *João me deve 150 vence 15/10*\n• *João pagou 50*\n• *João vence 20/10*\n• *quem me deve?*\n• registre parcial ou quitação\n• altere vencimento, nome ou valor total\n• excedente é separado em valor aplicado + crédito do contato";else if(topic==="assinaturas")msg="🔁 *Assinaturas e recorrências*\n\n• *criar assinatura* / *minhas assinaturas*\n• pausar ou retomar\n• alterar valor e vencimento\n• cancelar no Finance\n• consultar próximas dos 7 dias\n• lançamentos comuns também aceitam recorrência semanal, quinzenal, mensal e bimestral";else if(topic==="consultas")msg="📊 *Consultas e relatórios*\n\n• saldo de uma conta e contas negativas\n• total da empresa\n• entradas e gastos por período\n• maiores despesas e categorias\n• valores a receber e vencidos\n• assinaturas dos próximos 7 dias\n• *como está a empresa hoje?*\n• *resumo novembro* / *extrato novembro*\n• combine consultas com *empresa* ou *pessoal*\n• /saldo · /resumo · /relatorio";else msg="🏷️ *Categorias e organização*\n\n• *criar categoria*\n• o bot sugere categoria pelo texto\n• aprende associações usadas anteriormente\n• respeita Receita/Despesa e Empresa/Pessoal\n• você também pode trocar a categoria de uma pendência";const o=await reply(msg+"\n\nDigite *ajuda* para voltar à Central de Ajuda.");await done(aid,"extracted",o,{action:"help.menu_topic",topic});return new Response("OK")}
if(s?.step==="DEBT_DUE_PICK"){const d=sd.items?.[Number(text)-1];if(!d){const o=await reply("⚠️ Escolha uma cobrança válida.");await done(aid,"extracted",o);return new Response("OK")}await save(phone,"DEBT_DUE_CONFIRM",{debt:d,new_due:sd.new_due,friendly:sd.friendly});const o=await reply(`📅 *Alterar vencimento*\n\n👤 *${d.person_name}*\nDe: *${d.due_date||"sem data"}*\nPara: *${sd.friendly}*\n\n*1* — Confirmar\n*2* — Cancelar`);await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="DEBT_DUE_CONFIRM"){if(text==="2"){await clear(phone);const o=await reply("Alteração cancelada.");await done(aid,"extracted",o);return new Response("OK")}if(text!=="1"){const o=await reply("Responda *1* para confirmar ou *2* para cancelar.");await done(aid,"extracted",o);return new Response("OK")}const up=await db.from("debts").update({due_date:sd.new_due,updated_at:new Date().toISOString(),sync_status:"synced"}).eq("id",sd.debt.id).eq("user_id",u.user_id).select("id").single();if(up.error)throw up.error;await clear(phone);const o=await reply(`✅ *Vencimento atualizado!*\n\n👤 *${sd.debt.person_name}*\n📅 *${sd.friendly}*`);await done(aid,"extracted",o,{action:"receivable.update_due_direct",debt_id:sd.debt.id,due_date:sd.new_due});return new Response("OK")}
if(s?.step==="DEBT_PAY_PICK"){const d=sd.items?.[Number(text)-1];if(!d){const o=await reply("⚠️ Escolha uma cobrança válida.");await done(aid,"extracted",o);return new Response("OK")}const rem=Math.max(0,Number(d.total_amount||0)-Number(d.paid_amount||0));await save(phone,"DEBT_ACTION",{debt:d});const o=await reply(`👤 *${d.person_name}*\n💰 Falta receber: *${money(rem)}*${d.due_date?`\n📅 Vencimento: *${d.due_date}*`:""}\n\n*1* — Registrar pagamento\n*2* — Alterar vencimento\n*3* — Alterar nome\n*4* — Alterar valor total\n*5* — Voltar`);await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="DEBT_ACTION"){if(text==="5"){await clear(phone);const o=await reply("Certo.");await done(aid,"extracted",o);return new Response("OK")}if(text==="2"){await save(phone,"DEBT_EDIT_DUE",sd);const o=await reply("📅 Qual o novo vencimento?\nEx.: *15/10/2026*");await done(aid,"extracted",o);return new Response("OK")}if(text==="3"){await save(phone,"DEBT_EDIT_NAME",sd);const o=await reply("👤 Qual será o novo nome?");await done(aid,"extracted",o);return new Response("OK")}if(text==="4"){await save(phone,"DEBT_EDIT_TOTAL",sd);const o=await reply("💰 Qual será o novo valor total da cobrança?");await done(aid,"extracted",o);return new Response("OK")}if(text!=="1"){const o=await reply("Escolha *1* pagamento, *2* vencimento, *3* nome, *4* valor total ou *5* voltar.");await done(aid,"extracted",o);return new Response("OK")}await save(phone,"DEBT_PAY_AMOUNT",sd);const rem=Math.max(0,Number(sd.debt.total_amount||0)-Number(sd.debt.paid_amount||0));const o=await reply(`💰 Quanto foi pago?\nDigite *quitar* para receber os *${money(rem)}* restantes.`);await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="DEBT_EDIT_NAME"){const name=text.trim().slice(0,100);if(!name){const o=await reply("Informe um nome válido.");await done(aid,"extracted",o);return new Response("OK")}const up=await db.from("debts").update({person_name:name,updated_at:new Date().toISOString(),sync_status:"synced"}).eq("id",sd.debt.id).eq("user_id",u.user_id).select("id").single();if(up.error)throw up.error;await clear(phone);const o=await reply(`✅ Nome atualizado para *${name}*.`);await done(aid,"extracted",o,{action:"receivable.update_name",debt_id:sd.debt.id});return new Response("OK")}
if(s?.step==="DEBT_EDIT_TOTAL"){const v=amount(text),paid=Number(sd.debt.paid_amount||0);if(!v||v<paid){const o=await reply(`Informe um valor válido, igual ou maior que o já recebido (*${money(paid)}*).`);await done(aid,"extracted",o);return new Response("OK")}const status=paid>=v?"paid":paid>0?"partial":"pending",up=await db.from("debts").update({total_amount:v,status,updated_at:new Date().toISOString(),sync_status:"synced"}).eq("id",sd.debt.id).eq("user_id",u.user_id).select("id").single();if(up.error)throw up.error;await clear(phone);const o=await reply(`✅ Valor total atualizado para *${money(v)}*.${paid>0?`\nJá recebido: *${money(paid)}*`:""}`);await done(aid,"extracted",o,{action:"receivable.update_total",debt_id:sd.debt.id,total_amount:v});return new Response("OK")}
if(s?.step==="DEBT_EDIT_DUE"){const m=text.match(/\b(0?[1-9]|[12]\d|3[01])[\/-](0?[1-9]|1[0-2])(?:[\/-](\d{2}|\d{4}))?\b/);if(!m){const o=await reply("Informe uma data como *15/10* ou *15/10/2026*. Sem o ano, uso o ano atual.");await done(aid,"extracted",o);return new Response("OK")}const yy=m[3]?Number(m[3].length===2?"20"+m[3]:m[3]):Number(day().slice(0,4)),mm=Number(m[2]),dd=Number(m[1]),x=new Date(Date.UTC(yy,mm-1,dd,12));if(x.getUTCFullYear()!==yy||x.getUTCMonth()!==mm-1||x.getUTCDate()!==dd){const o=await reply("Essa data não é válida.");await done(aid,"extracted",o);return new Response("OK")}const due=`${yy}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`,friendly=`${String(dd).padStart(2,"0")}/${String(mm).padStart(2,"0")}/${yy}`,up=await db.from("debts").update({due_date:due,updated_at:new Date().toISOString(),sync_status:"synced"}).eq("id",sd.debt.id).eq("user_id",u.user_id);if(up.error)throw up.error;await clear(phone);const o=await reply(`✅ *Vencimento atualizado!*\n\n👤 *${sd.debt.person_name}*\n📅 *${friendly}*`);await done(aid,"extracted",o,{action:"receivable.update_due",debt_id:sd.debt.id,due_date:due});return new Response("OK")}
if(s?.step==="DEBT_PAY_AMOUNT"){const rem=Math.max(0,Number(sd.debt.total_amount||0)-Number(sd.debt.paid_amount||0)),v=N(text)==="quitar"?rem:amount(text),pay_date=explicitDate(text)||(/\b(hoje|ontem|anteontem)\b/.test(n)?naturalDate(text):sd.pay_date||day());if(!v){const o=await reply("Informe um valor válido ou digite *quitar*. Você também pode dizer *50 ontem* ou *50 em 03/10/2026*.");await done(aid,"extracted",o);return new Response("OK")}const aa=await accs(u.user_id,sd.debt.context);await save(phone,"DEBT_PAY_ACC",{...sd,pay_amount:v,pay_date,accounts:aa});const o=await reply(list(aa,"🏦 *Em qual conta o dinheiro entrou?*",true));await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="DEBT_PAY_ACC"){const acc=sd.accounts?.[Number(text)-1];if(!acc){const o=await reply("⚠️ Escolha uma conta válida.");await done(aid,"extracted",o);return new Response("OK")}const rem=Math.max(0,Number(sd.debt.total_amount||0)-Number(sd.debt.paid_amount||0)),applied=Math.min(Number(sd.pay_amount),rem),credit=Math.max(0,Number(sd.pay_amount)-rem);await save(phone,"DEBT_PAY_CONFIRM",{...sd,account:acc,payment_operation_id:crypto.randomUUID()});const o=await reply(`💵 *Confirmar recebimento*\n\n👤 *${sd.debt.person_name}*\n💰 Recebido: *${money(sd.pay_amount)}*\n🧾 Aplicado à cobrança: *${money(applied)}*${credit>0?`\n💳 Excedente como crédito: *${money(credit)}*`:""}\n🏦 Conta: *${acc.name}*\n📅 Data: *${brDate(sd.pay_date||day())}*\n\n*1* — Confirmar\n*2* — Cancelar`);await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="DEBT_PAY_CONFIRM"){if(text==="2"){await clear(phone);const o=await reply("🚫 Recebimento cancelado.");await done(aid,"extracted",o);return new Response("OK")}if(text!=="1"){const o=await reply("Responda *1* para confirmar ou *2* para cancelar.");await done(aid,"extracted",o);return new Response("OK")}const key=sd.payment_operation_id||await uid(`${u.user_id}:debt-confirm:${sd.debt.id}:${sd.debt.paid_amount||0}:${sd.pay_amount}:${sd.account.id}:${sd.pay_date||day()}`),rr=await db.rpc("bot_record_debt_payment",{p_user_id:u.user_id,p_debt_id:sd.debt.id,p_account_id:sd.account.id,p_amount:sd.pay_amount,p_date:sd.pay_date||day(),p_description:`Pagamento de ${sd.debt.person_name}`,p_idempotency_key:key});if(rr.error)throw rr.error;await clear(phone);const x=rr.data||{},applied=Number(x.applied||Math.min(Number(sd.pay_amount),Math.max(0,Number(sd.debt.total_amount||0)-Number(sd.debt.paid_amount||0)))),credit=Number(x.credit||0),remaining=Number(x.remaining||0);const o=await reply(`✅ *Recebimento registrado!*\n\n👤 *${sd.debt.person_name}*\n💰 Recebido: *${money(sd.pay_amount)}*\n🧾 Aplicado à cobrança: *${money(applied)}*${credit>0?`\n💳 Crédito gerado: *${money(credit)}*`:""}\n🏦 *${sd.account.name}*\n📅 *${brDate(sd.pay_date||day())}*\n📊 Novo saldo: *${money(x.new_balance)}*${remaining>0?`\n🕒 Ainda falta receber: *${money(remaining)}*`:"\n🎉 *Cobrança quitada*"}\n\n_Dica: diga “quem me deve?” para revisar outras cobranças._`);await done(aid,"extracted",o,{action:"receivable.payment",debt_id:sd.debt.id,transaction_id:x.transaction_id,applied,credit,remaining});return new Response("OK")}
if(s?.step==="SUB_PICK"){const sub=sd.items?.[Number(text)-1];if(!sub){const o=await reply("⚠️ Escolha uma assinatura válida.");await done(aid,"extracted",o);return new Response("OK")}await save(phone,"SUB_ACTION",{sub});const o=await reply(`🔁 *${sub.name}*\n💰 ${money(sub.amount)}\n📅 Próxima: ${sub.next_due_date||`dia ${sub.due_day}`}\nStatus: *${sub.status}*\n\n*1* — ${sub.status==="paused"?"Retomar":"Pausar"}\n*2* — Alterar valor\n*3* — Alterar vencimento\n*4* — Cancelar no Finance\n*5* — Voltar`);await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="SUB_ACTION"){if(text==="5"){await clear(phone);const o=await reply("Certo.");await done(aid,"extracted",o);return new Response("OK")}if(text==="2"){await save(phone,"SUB_EDIT_AMOUNT",sd);const o=await reply("💰 Qual será o *novo valor* da assinatura?");await done(aid,"extracted",o);return new Response("OK")}if(text==="3"){await save(phone,"SUB_EDIT_DAY",sd);const o=await reply("📅 Qual será o *novo dia de vencimento*?");await done(aid,"extracted",o);return new Response("OK")}if(text==="4"){await save(phone,"SUB_CANCEL",sd);const o=await reply(`⚠️ Cancelar *${sd.sub.name}* no Finance?\nIsso não cancela a cobrança no fornecedor.\n\n*1* — Confirmar\n*2* — Voltar`);await done(aid,"extracted",o);return new Response("OK")}if(text!=="1"){const o=await reply("Escolha uma opção de *1 a 5*.");await done(aid,"extracted",o);return new Response("OK")}const status=sd.sub.status==="paused"?"active":"paused",up=await db.from("subscriptions").update({status,updated_at:new Date().toISOString()}).eq("id",sd.sub.id).eq("user_id",u.user_id).select("id").single();if(up.error)throw up.error;await clear(phone);const o=await reply(`✅ *${sd.sub.name}* ${status==="paused"?"pausada":"reativada"}.`);await done(aid,"extracted",o,{action:"subscription.status",subscription_id:sd.sub.id,status});return new Response("OK")}
if(s?.step==="SUB_EDIT_AMOUNT"){const v=amount(text);if(!v){const o=await reply("Informe um valor válido.");await done(aid,"extracted",o);return new Response("OK")}const up=await db.from("subscriptions").update({amount:v,updated_at:new Date().toISOString()}).eq("id",sd.sub.id).eq("user_id",u.user_id).select("id").single();if(up.error)throw up.error;await clear(phone);const o=await reply(`✅ *${sd.sub.name}* atualizada para *${money(v)}*.`);await done(aid,"extracted",o,{action:"subscription.amount",subscription_id:sd.sub.id});return new Response("OK")}
if(s?.step==="SUB_EDIT_DAY"){const d=Number(text);if(!Number.isInteger(d)||d<1||d>31){const o=await reply("Informe um dia entre *1 e 31*.");await done(aid,"extracted",o);return new Response("OK")}const up=await db.from("subscriptions").update({due_day:d,updated_at:new Date().toISOString()}).eq("id",sd.sub.id).eq("user_id",u.user_id).select("id").single();if(up.error)throw up.error;await clear(phone);const o=await reply(`✅ Vencimento de *${sd.sub.name}* alterado para dia *${d}*.`);await done(aid,"extracted",o,{action:"subscription.due_day",subscription_id:sd.sub.id});return new Response("OK")}
if(s?.step==="SUB_CANCEL"){if(text==="2"){await clear(phone);const o=await reply("Cancelamento abortado.");await done(aid,"extracted",o);return new Response("OK")}if(text!=="1"){const o=await reply("Escolha *1* confirmar ou *2* voltar.");await done(aid,"extracted",o);return new Response("OK")}const up=await db.from("subscriptions").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",sd.sub.id).eq("user_id",u.user_id).select("id").single();if(up.error)throw up.error;await clear(phone);const o=await reply(`✅ *${sd.sub.name}* foi marcada como cancelada no Finance.\n_O cancelamento no fornecedor continua sendo feito separadamente._`);await done(aid,"extracted",o,{action:"subscription.cancel",subscription_id:sd.sub.id});return new Response("OK")}
if(s?.step==="PENDING_PICK"){const tx=sd.items?.[Number(text)-1];if(!tx){const o=await reply("⚠️ Escolha uma pendência válida.");await done(aid,"extracted",o);return new Response("OK")}await save(phone,"PENDING_CONFIRM",{tx});const o=await reply(`🧾 *Revisar pendência*\n\n${tx.type==="income"?"🟢 Receita":"🔴 Despesa"} · *${money(tx.amount)}*\n📝 ${tx.description||"Sem descrição"}\n📅 ${tx.date}\n\n*1* — Efetivar agora\n*2* — Manter pendente\n*3* — Corrigir`);await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="PENDING_CONFIRM"){if(text==="2"){await clear(phone);const o=await reply("🕒 Pendência mantida sem alterações.");await done(aid,"extracted",o);return new Response("OK")}if(text==="3"){await save(phone,"PENDING_EDIT",sd);const o=await reply("✏️ *Corrigir pendência*\n\nPode falar naturalmente:\n• *muda o valor para 35,90*\n• *foi ontem* ou *data 15/10/2026*\n• *muda a descrição para Mercado*\n• *troca a conta para Nubank*\n• *muda a categoria para Supermercado*\n\nEu altero somente o campo pedido e preservo o restante.");await done(aid,"extracted",o);return new Response("OK")}if(text!=="1"){const o=await reply("Responda *1* efetivar, *2* manter ou *3* corrigir.");await done(aid,"extracted",o);return new Response("OK")}const rr=await db.rpc("bot_settle_transaction",{p_user_id:u.user_id,p_transaction_id:sd.tx.id});if(rr.error)throw rr.error;await clear(phone);const meta=rr.data||{},receipt=meta.receipt_attached===true;const o=await reply(`✅ *${sd.tx.type==="income"?"Receita":"Despesa"} efetivada!*\n\n💰 *${money(sd.tx.amount)}*\n📝 ${meta.description||sd.tx.description||"Movimentação"}${receipt?"\n📎 Comprovante anexado":""}\n📊 Novo saldo: *${money(meta.new_balance)}*\n\n_Dica: você pode corrigir pendências antes de efetivar dizendo “troca a conta para Nubank”, “muda a categoria para Supermercado” ou “foi ontem”._`);await done(aid,"extracted",o,{action:"transaction.settle",transaction_id:sd.tx.id,receipt_attached:receipt,new_balance:meta.new_balance});return new Response("OK")}
if(s?.step==="PENDING_EDIT"){const vm=n.match(/^(?:valor|muda(?: o)? valor(?: para)?|corrige(?: o)? valor(?: para)?|altera(?: o)? valor(?: para)?)\s+(?:r\$\s*)?([\d.,]+)/),dm=n.match(/^(?:descricao|descrição|muda(?: a)? descricao(?: para)?|muda(?: a)? descrição(?: para)?|altera(?: a)? descricao(?: para)?|altera(?: a)? descrição(?: para)?)\s+(.+)/i),am=n.match(/^(?:conta|muda(?: a)? conta(?: para)?|troca(?: a)? conta(?: para)?|altera(?: a)? conta(?: para)?)\s+(.+)/i),cm=n.match(/^(?:categoria|muda(?: a)? categoria(?: para)?|troca(?: a)? categoria(?: para)?|altera(?: a)? categoria(?: para)?)\s+(.+)/i);if(am){const aa=await allAccs(u.user_id),acc=matchNamed(aa,am[1].trim());if(!acc){const o=await reply("Não encontrei essa conta. Use o nome como aparece no Finance.");await done(aid,"extracted",o);return new Response("OK")}const up=await db.from("transactions").update({account_id:acc.id,context:acc.context,updated_at:new Date().toISOString(),sync_status:"synced"}).eq("id",sd.tx.id).eq("user_id",u.user_id).eq("status","pending").eq("affects_balance",false).select("id").single();if(up.error)throw up.error;const tx={...sd.tx,account_id:acc.id,context:acc.context};await save(phone,"PENDING_CONFIRM",{tx});const o=await reply(`✏️ *Conta alterada*\n\n🏦 *${acc.name}*\n\nVocê pode continuar corrigindo: *categoria Supermercado*, *valor 35,90*, *foi ontem* ou *descrição Mercado*.\n\n*1* — Efetivar\n*2* — Manter\n*3* — Corrigir novamente`);await done(aid,"extracted",o,{action:"transaction.pending_account",transaction_id:tx.id,account_id:acc.id});return new Response("OK")}if(cm){const cc=await cats(u.user_id,sd.tx.context,sd.tx.type==="income"?"income":"expense"),cat=matchNamed(cc,cm[1].trim());if(!cat){const o=await reply("Não encontrei essa categoria para essa transação.");await done(aid,"extracted",o);return new Response("OK")}const up=await db.from("transactions").update({category_id:cat.id,updated_at:new Date().toISOString(),sync_status:"synced"}).eq("id",sd.tx.id).eq("user_id",u.user_id).eq("status","pending").eq("affects_balance",false).select("id").single();if(up.error)throw up.error;const tx={...sd.tx,category_id:cat.id};await save(phone,"PENDING_CONFIRM",{tx});const o=await reply(`✏️ *Categoria alterada*\n\n🏷️ *${cat.name}*\n\n*1* — Efetivar\n*2* — Manter\n*3* — Corrigir novamente`);await done(aid,"extracted",o,{action:"transaction.pending_category",transaction_id:tx.id,category_id:cat.id});return new Response("OK")}let args:any={p_user_id:u.user_id,p_transaction_id:sd.tx.id,p_amount:null,p_description:null,p_date:null};if(vm)args.p_amount=amount(vm[1]);else if(/\b(ontem|anteontem|hoje|amanha|amanhã)\b/.test(n))args.p_date=naturalDate(n);else if(dm)args.p_description=dm[1].trim().slice(0,160);else{const md=text.match(/\b(0?[1-9]|[12]\d|3[01])[\/-](0?[1-9]|1[0-2])(?:[\/-](\d{2}|\d{4}))?\b/);if(!md){const o=await reply("Use *valor 35,90*, *foi ontem*, *data 15/10/2026*, *descrição Mercado*, *conta Nubank* ou *categoria Supermercado*.");await done(aid,"extracted",o);return new Response("OK")}const yy=md[3]?Number(md[3].length===2?"20"+md[3]:md[3]):Number(day().slice(0,4)),mm=Number(md[2]),dd=Number(md[1]),x=new Date(Date.UTC(yy,mm-1,dd,12));if(x.getUTCFullYear()!==yy||x.getUTCMonth()!==mm-1||x.getUTCDate()!==dd){const o=await reply("Essa data não é válida.");await done(aid,"extracted",o);return new Response("OK")}args.p_date=`${yy}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`}const rr=await db.rpc("bot_update_pending_transaction",args);if(rr.error)throw rr.error;const tx={...sd.tx,...rr.data};await save(phone,"PENDING_CONFIRM",{tx});const o=await reply(`✏️ *Pendência corrigida*\n\n${tx.type==="income"?"🟢 Receita":"🔴 Despesa"} · *${money(tx.amount)}*\n📝 ${tx.description||"Sem descrição"}\n📅 ${tx.date}\n\n*1* — Efetivar\n*2* — Manter\n*3* — Corrigir novamente`);await done(aid,"extracted",o,{action:"transaction.pending_correct",transaction_id:tx.id});return new Response("OK")}
if(s?.step==="SUB_NAME"){if(!text){return new Response("OK")}await save(phone,"SUB_AMOUNT",{...sd,name:text.slice(0,80)});const o=await reply("💰 Qual é o *valor* da assinatura?");await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="SUB_AMOUNT"){const v=amount(text);if(!v){const o=await reply("Informe um valor válido. Ex.: *44,90*");await done(aid,"extracted",o);return new Response("OK")}await save(phone,"SUB_DAY",{...sd,amount:v});const o=await reply("📅 Qual o *dia do vencimento*? Ex.: *10*");await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="SUB_DAY"){const d=Number(text);if(!Number.isInteger(d)||d<1||d>31){const o=await reply("Informe um dia entre *1 e 31*.");await done(aid,"extracted",o);return new Response("OK")}await save(phone,"SUB_CTX",{...sd,due_day:d});const o=await reply("🏦 Qual o contexto?\n*1* — 🏢 Empresa\n*2* — 👤 Pessoal");await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="SUB_CTX"){const context=conversationalContext(text);if(!context){const o=await reply("Pode responder *Empresa* ou *Pessoal*.");await done(aid,"extracted",o);return new Response("OK")}const aa=await accs(u.user_id,context);await save(phone,"SUB_ACC",{...sd,context,accounts:aa});const o=await reply(list(aa,"🏦 *Conta da assinatura:*",true));await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="SUB_ACC"){const acc=pickNamed(sd.accounts||[],text);if(!acc){const o=await reply("⚠️ Não reconheci essa conta. Responda pelo nome ou número.");await done(aid,"extracted",o);return new Response("OK")}const nd=botNextMonthlyDueCivil(sd.due_day);const row={user_id:u.user_id,context:sd.context,name:sd.name,amount:sd.amount,account_id:acc.id,due_day:sd.due_day,billing_cycle:"monthly",next_due_date:nd,status:"active",icon:"repeat",color:"#14b8a6"};const ins=await db.from("subscriptions").insert(row).select("id").single();if(ins.error)throw ins.error;await clear(phone);const o=await reply(`🔁 *Assinatura criada!*\n\n*${sd.name}*\n💰 ${money(sd.amount)}\n📅 Dia *${sd.due_day}* de cada mês\n🗓️ Próximo: *${nd.split("-").reverse().join("/")}*\n🏦 *${acc.name}*\n🏷️ Mensal`);await done(aid,"extracted",o,{action:"subscription.create",subscription_id:ins.data.id});return new Response("OK")}
if(s?.step==="DEBT_NAME"){await save(phone,"DEBT_AMOUNT",{...sd,person_name:text.slice(0,100)});const o=await reply("💰 Quanto *essa pessoa te deve*?");await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="DEBT_AMOUNT"){const v=amount(text);if(!v){const o=await reply("Informe um valor válido.");await done(aid,"extracted",o);return new Response("OK")}await save(phone,"DEBT_DUE",{...sd,total_amount:v});const o=await reply("📅 Qual o vencimento?\nEx.: *15/10/2026* ou *sem data*");await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="DEBT_DUE"){let due=null;if(N(text)!=="sem data"){const parsed=botParseReceivableDueDate(text);if(!parsed.ok){const o=await reply("⚠️ Data inválida. Use *DD/MM/AAAA*, *DD/MM*, *hoje*, *amanhã* ou *sem data*. Ex.: 29/02/2028.");await done(aid,"extracted",o);return new Response("OK")}due=parsed.due}await save(phone,"DEBT_CTX",{...sd,due_date:due});const o=await reply("🏦 Contexto:\n*1* — 🏢 Empresa\n*2* — 👤 Pessoal");await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="DEBT_CTX"){if(!["1","2"].includes(text)){const o=await reply("Escolha *1* Empresa ou *2* Pessoal.");await done(aid,"extracted",o);return new Response("OK")}const context=text==="1"?"dfl":"personal";await save(phone,"DEBT_CONFIRM",{...sd,context});const o=await reply(`👤 *Quem me deve*\n\nPessoa: *${sd.person_name}*\nValor: *${money(sd.total_amount)}*\nVencimento: *${sd.due_date||"Sem data"}*\nContexto: *${context==="dfl"?"Empresa":"Pessoal"}*\n\n*1* — Criar\n*2* — Cancelar`);await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="DEBT_CONFIRM"){if(text==="2"){await clear(phone);const o=await reply("🚫 Cadastro cancelado.");await done(aid,"extracted",o);return new Response("OK")}if(text!=="1"){const o=await reply("Responda *1* para criar ou *2* para cancelar.");await done(aid,"extracted",o);return new Response("OK")}let c=await db.from("contacts").select("id").eq("user_id",u.user_id).eq("context",sd.context).ilike("name",sd.person_name).limit(1).maybeSingle();let cid=c.data?.id;if(!cid){const ci=await db.from("contacts").insert({user_id:u.user_id,name:sd.person_name,type:"customer",relationship_type:"customer",entity_type:"individual",context:sd.context,icon:"user",color:"#14b8a6"}).select("id").single();if(ci.error)throw ci.error;cid=ci.data.id}const di=await db.from("debts").insert({user_id:u.user_id,context:sd.context,person_name:sd.person_name,total_amount:sd.total_amount,paid_amount:0,due_date:sd.due_date,description:`Valor a receber de ${sd.person_name}`,status:"pending",contact_id:cid,icon:"user",color:"#14b8a6",sync_status:"synced"}).select("id").single();if(di.error)throw di.error;await clear(phone);const o=await reply(`✅ *Valor a receber criado!*\n\n👤 *${sd.person_name}*\n💰 *${money(sd.total_amount)}*\n📅 ${sd.due_date||"Sem vencimento"}`);await done(aid,"extracted",o,{action:"receivable.create",debt_id:di.data.id,contact_id:cid});return new Response("OK")}
if(s?.step==="CAT_NAME"){await save(phone,"CAT_TYPE",{...sd,name:text.slice(0,80)});const o=await reply("🏷️ Essa categoria é de:\n*1* — 🔴 Despesa\n*2* — 🟢 Receita");await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="CAT_TYPE"){if(!["1","2"].includes(text)){const o=await reply("Escolha *1* Despesa ou *2* Receita.");await done(aid,"extracted",o);return new Response("OK")}await save(phone,"CAT_CTX",{...sd,type:text==="1"?"expense":"income"});const o=await reply("🏦 Contexto:\n*1* — 🏢 Empresa\n*2* — 👤 Pessoal");await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="CAT_CTX"){if(!["1","2"].includes(text)){const o=await reply("Escolha *1* Empresa ou *2* Pessoal.");await done(aid,"extracted",o);return new Response("OK")}const context=text==="1"?"dfl":"personal",ex=await db.from("categories").select("id,name").eq("user_id",u.user_id).eq("context",context).eq("type",sd.type).ilike("name",sd.name).limit(1).maybeSingle();if(ex.data){await clear(phone);const o=await reply(`ℹ️ A categoria *${ex.data.name}* já existe nesse contexto.`);await done(aid,"extracted",o);return new Response("OK")}const ci=await db.from("categories").insert({user_id:u.user_id,name:sd.name,type:sd.type,context,color:"#64748b",icon:sd.type==="income"?"trending-up":"tag",is_default:false}).select("id").single();if(ci.error)throw ci.error;await clear(phone);const o=await reply(`✅ *Categoria criada!*\n\n🏷️ *${sd.name}*\n${sd.type==="income"?"🟢 Receita":"🔴 Despesa"} · ${context==="dfl"?"🏢 Empresa":"👤 Pessoal"}`);await done(aid,"extracted",o,{action:"category.create",category_id:ci.data.id});return new Response("OK")}
if(s?.step==="TX_AMOUNT"){
  const av=amount(text);
  if(!av){const o=await reply(voiceAmount(sd.type,k,true));await done(aid,"extracted",o,{action:"clarify.amount.retry",type:sd.type});return new Response("OK")}
  const synthetic=`${sd.type==="income"?"recebi":"gastei"} ${text}`;
  await clear(phone);
  text=synthetic;
  n=N(text);
}
if(s?.step==="TX_CONFIRM"){
  const choice=conversationalChoice(text,"TX_CONFIRM");
  /* V163: a correção direta do rascunho NÃO equivale à confirmação financeira. */
  const parsedInline=txCorrectionPatch(text);
  const inlineCorrection=choice!=="confirm" && parsedInline.fields.length>0 && parsedInline.errors.length===0;
  if(choice==="correct"&&!inlineCorrection){
    const focus=txCorrectionFocus(text);
    await save(phone,"TX_CORRECT",{...sd,correction_focus:focus});
    const o=await reply(focus==="description"
      ?"✏️ *Qual é o nome/descrição correto do lançamento?*\nPode responder só com o nome, por exemplo *Vendas do dia 17*."
      :focus==="amount"?"✏️ *Qual o valor correto?* Ex.: *300,00*."
      :focus==="account"?"✏️ *Qual conta correta?* Responda pelo nome da conta cadastrada."
      :focus==="category"?"✏️ *Qual categoria correta?* Responda pelo nome."
      :focus==="date"?"✏️ *Qual data correta?* Ex.: *17/10* ou *ontem*."
      :focus==="context"?"✏️ *É Empresa ou Pessoal?*"
      :"✏️ *O que quer corrigir?*\nPode mandar um ou vários campos:\n• *nome Vendas do dia 17*\n• *valor 300,00*\n• *conta Carteira*\n• *data 17/10*\n• *categoria Vendas*\n\nTambém entendo vários campos, cada um em uma linha. Para recomeçar: *refazer*.");
    await done(aid,"extracted",o,{action:"transaction.correction.request",focus});return new Response("OK")
  }
  if(choice==="confirm"){
    await afterConfirm(u,phone,sd,reply,aid);return new Response("OK")
  }
  if(inlineCorrection){
    /* A mesma mensagem cai no handler TX_CORRECT abaixo, sem chamar RPC. */
    s={...s,step:"TX_CORRECT"};
    sd={...sd,correction_focus:null};
  }else{
    const o=await reply("Pode dizer *sim* para confirmar, *corrigir nome*, *corrigir valor*, *corrigir conta* ou apenas *2* para editar. Também pode *cancelar*.");
    await done(aid,"extracted",o);return new Response("OK")
  }
}
if(s?.step==="TX_CORRECT"){
  if(n==="refazer"){
    await clear(phone);const o=await reply("✏️ Certo. Mande o lançamento novamente do seu jeito.");
    await done(aid,"extracted",o);return new Response("OK")
  }
  const parsed=txCorrectionPatch(text,sd.correction_focus||null);
  if(parsed.errors.length||!parsed.fields.length){
    const reason=parsed.errors[0]||"Nenhum campo identificado.";
    const o=await reply(`⚠️ ${reason}\n\nTente *nome Vendas*, *valor 300,00*, *conta Carteira*, *data 17/10* ou envie um campo por linha. Nada foi alterado.`);
    await done(aid,"extracted",o,{action:"transaction.correction.retry"});return new Response("OK")
  }
  const patch=parsed.patch,next={...sd};delete next.correction_focus;
  if(patch.accountName){
    const all=await allAccs(u.user_id),name=N(patch.accountName);
    const exact=all.filter((a:any)=>N(String(a.name||""))===name);
    const candidates=exact.length?exact:all.filter((a:any)=>N(String(a.name||"")).includes(name));
    const narrowed=patch.context?candidates.filter((a:any)=>a.context===patch.context):candidates;
    if(narrowed.length!==1){
      const suffix=narrowed.length>1?"Encontrei mais de uma conta com esse nome; informe também *contexto Empresa* ou *contexto Pessoal*.":"Não encontrei essa conta cadastrada no contexto informado.";
      const o=await reply(`⚠️ ${suffix}\nNenhuma alteração foi aplicada. Pode enviar os campos novamente.`);
      await done(aid,"extracted",o,{action:"transaction.correction.account_ambiguous"});return new Response("OK")
    }
    next.account=narrowed[0];next.account_explicit=narrowed[0].name;next.account_ambiguous=false;
    next.context=narrowed[0].context;
  }else if(patch.context){
    next.context=patch.context;
    if(next.account?.context!==patch.context){next.account=null;next.account_explicit=null;next.account_ambiguous=false;}
  }
  if(patch.amount!==undefined)next.amount=patch.amount;
  if(patch.description!==undefined){next.description=patch.description;
    if(!patch.categoryName&&!next.category_explicit)next.category_hint=hint(next.description,next.type);
  }
  if(patch.date!==undefined)next.date=patch.date;
  if(patch.categoryName!==undefined){next.category_explicit=patch.categoryName;next.category_hint=null;}
  await save(phone,"TX_CONFIRM",next);
  const labels:Record<string,string>={amount:"valor",description:"nome/descrição",accountName:"conta",categoryName:"categoria",context:"contexto",date:"data"};
  const changes=parsed.fields.map((f:string)=>labels[f]||f).join(", ");
  const o=await reply(`✏️ *Rascunho atualizado:* ${changes}.\n\n${next.type==="income"?"🟢 Receita":"🔴 Despesa"} · *${money(next.amount)}*\n📝 *${next.description||"Sem descrição"}*\n📅 *${brDate(next.date)}*\n🏦 ${next.account?.name||next.account_explicit||"Conta a confirmar"}\n🏷️ ${next.category_explicit||next.category_hint||"Categoria a confirmar"}\n${next.context==="dfl"?"🏢 Empresa":next.context==="personal"?"👤 Pessoal":"Contexto a confirmar"}\n\n*1* — Confirmar\n*2* — Corrigir novamente\n\n_Nenhum lançamento foi registrado nesta correção._`);
  await done(aid,"extracted",o,{action:"transaction.correct",fields:parsed.fields});return new Response("OK")
}
if(s?.step==="TX_SETTLE"){const choice=conversationalChoice(text,"TX_SETTLE");if(choice==="pending"){await clear(phone);const o=await reply("🕒 *Mantida como pendente.*\nVocê pode revisar e efetivar depois no DFL Finance.");await done(aid,"extracted",o);return new Response("OK")}if(choice!=="settle"){const o=await reply("Diga *efetivar* para atualizar o saldo ou *deixa pendente* para decidir depois. Também aceito *1* e *2*.");await done(aid,"extracted",o);return new Response("OK")}const rr=await db.rpc("bot_settle_transaction",{p_user_id:u.user_id,p_transaction_id:sd.transaction_id});if(rr.error)throw rr.error;await clear(phone);const meta=rr.data||{},desc=meta.description||"Movimentação",receipt=meta.receipt_attached===true;const o=await reply(`✅ *${sd.type==="income"?"Receita":"Despesa"} efetivada!*\n\n💰 *${money(sd.amount)}*\n📝 ${desc}\n🏦 *${sd.account?.name||"Conta"}*${sd.category?.name?`\n🏷️ *${sd.category.name}*`:""}${receipt?"\n📎 Comprovante anexado":""}\n📊 Novo saldo: *${money(meta.new_balance)}*`);await done(aid,"extracted",o,{settled:true,transaction_id:sd.transaction_id,receipt_attached:receipt,new_balance:meta.new_balance});return new Response("OK")}
if(s?.step==="TX_CTX"){const c=conversationalContext(text);if(!c){const o=await reply("Pode responder *Empresa* ou *Pessoal*.");await done(aid,"extracted",o);return new Response("OK")}await afterConfirm(u,phone,{...sd,context:c},reply,aid);return new Response("OK")}
if(s?.step==="TX_ACC"){const acc=pickNamed(sd.accounts||[],text);if(!acc){const o=await reply("Não reconheci essa conta. Pode responder pelo *nome* ou pelo número mostrado.");await done(aid,"extracted",o);return new Response("OK")}const next={...sd,account:acc,account_explicit:acc.name,context:acc.context||sd.context};const r=await categoryStep(u,phone,next,acc,reply,aid);if(!r.pending)await recordTx(u,phone,next,acc,r.category,reply,aid);return new Response("OK")}
if(s?.step==="TX_CAT"){const idx=Number(text)-1;if(sd.all_categories?.length>sd.categories?.length&&idx===sd.categories.length){await save(phone,"TX_CAT_ALL",sd);const o=await reply(list(sd.all_categories,`🏷️ *Todas as categorias de ${sd.type==="income"?"receita":"despesa"}:*`));await done(aid,"extracted",o);return new Response("OK")}const cat=pickNamed(sd.categories||[],text);if(!cat){const o=await reply("Não reconheci essa categoria. Pode responder pelo *nome* ou pelo número mostrado.");await done(aid,"extracted",o);return new Response("OK")}await learnCategory(u.user_id,sd.description,cat.id);await recordTx(u,phone,sd,sd.account,cat,reply,aid);return new Response("OK")}
if(s?.step==="TX_CAT_ALL"){const cat=pickNamed(sd.all_categories||[],text);if(!cat){const o=await reply("Não reconheci essa categoria. Pode responder pelo *nome* ou pelo número mostrado.");await done(aid,"extracted",o);return new Response("OK")}await learnCategory(u.user_id,sd.description,cat.id);await recordTx(u,phone,sd,sd.account,cat,reply,aid);return new Response("OK")}
if(s?.step==="TR_CTX"){const context=conversationalContext(text);if(!context){const o=await reply("Pode responder *Empresa* ou *Pessoal*.");await done(aid,"extracted",o);return new Response("OK")}const aa=await accs(u.user_id,context);await save(phone,"TR_FROM",{...sd,context,accounts:aa});const visible=aa.filter((x:any)=>Number(x.balance)!==0);const o=await reply(list(visible,"🏦 *Conta de origem:*",true)+"\n_Contas zeradas ficam ocultas neste atalho._");await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="TR_FROM"){const visible=(sd.accounts||[]).filter((x:any)=>Number(x.balance)!==0),from=pickNamed(visible,text);if(!from){const o=await reply("⚠️ Escolha uma conta de origem válida.");await done(aid,"extracted",o);return new Response("OK")}const aa=await accs(u.user_id,sd.context);await save(phone,"TR_TO",{...sd,from,accounts:aa});const o=await reply(list(aa.filter((x:any)=>x.id!==from.id),"🏦 *Conta de destino:*",true));await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="TR_TO"){const visible=(sd.accounts||[]).filter((x:any)=>x.id!==sd.from?.id),to=pickNamed(visible,text);if(!to){const o=await reply("⚠️ Escolha uma conta de destino válida.");await done(aid,"extracted",o);return new Response("OK")}const fromAfter=Number(sd.from.balance||0)-Number(sd.amount),toAfter=Number(to.balance||0)+Number(sd.amount);await save(phone,"TR_CONFIRM",{...sd,to,fromAfter,toAfter});const warning=fromAfter<0?"\n⚠️ *A origem ficará negativa.*":"";const o=await reply(`🔄 *Confirmar transferência*\n\n*${sd.from.name}* → *${to.name}*\nValor: *${money(sd.amount)}*\n\nOrigem: ${money(sd.from.balance)} → *${money(fromAfter)}*\nDestino: ${money(to.balance)} → *${money(toAfter)}*${warning}\n\n*1* — Confirmar\n*2* — Cancelar`);await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="TR_CONFIRM"){const choice=conversationalChoice(text,"TR_CONFIRM");if(choice==="cancel"){await clear(phone);const o=await reply("🚫 Transferência cancelada.");await done(aid,"extracted",o);return new Response("OK")}if(choice!=="confirm"){const o=await reply("Diga *confirmar* para transferir ou *não* para desistir. Também aceito *1* e *2*.");await done(aid,"extracted",o);return new Response("OK")}const key=await uid(`whatsapp-transfer:${sd.provider_message_id}`),rr=await db.rpc("bot_record_transfer",{p_user_id:u.user_id,p_from_account_id:sd.from.id,p_to_account_id:sd.to.id,p_amount:Number(sd.amount),p_description:sd.description,p_idempotency_key:key,p_date:sd.date||day()});if(rr.error)throw rr.error;await clear(phone);const o=await reply(`✅ *Transferência concluída!*\n\n*${sd.from.name}* → *${sd.to.name}*\n💰 *${money(sd.amount)}*\n\nSaldo origem: *${money(rr.data?.from_balance)}*\nSaldo destino: *${money(rr.data?.to_balance)}*`);await done(aid,"inserted",o,{transfer:true,rpc:rr.data});return new Response("OK")}
if(s?.step==="SALDO_CTX"){const cs=text==="1"?["dfl"]:text==="2"?["personal"]:text==="3"?["dfl","personal"]:[];if(!cs.length){const o=await reply("Escolha *1*, *2* ou *3*.");await done(aid,"extracted",o);return new Response("OK")}const r=await db.from("accounts").select("name,balance,context").eq("user_id",u.user_id).in("context",cs).eq("is_archived",false).order("name");await clear(phone);let total=0,b="💰 *Saldos*\n\n";(r.data||[]).forEach((x:any)=>{total+=Number(x.balance||0);b+=`${x.context==="dfl"?"🏢":"👤"} *${x.name}:* ${money(x.balance)}\n`});b+=`\n📊 *Total:* ${money(total)}`;const o=await reply(b);await done(aid,"extracted",o);return new Response("OK")}
if(s?.step==="RESUMO_CTX"){const cs=text==="1"?["dfl"]:text==="2"?["personal"]:text==="3"?["dfl","personal"]:[];if(!cs.length){const o=await reply("Escolha *1*, *2* ou *3*.");await done(aid,"extracted",o);return new Response("OK")}const r=await db.from("transactions").select("description,amount,type").eq("user_id",u.user_id).in("context",cs).eq("status","done").eq("affects_balance",true).is("goal_id",null).in("type",["income","expense","sangria"]).order("date",{ascending:false}).limit(5);await clear(phone);let b="📋 *Últimas movimentações realizadas*\n\n";(r.data||[]).forEach((x:any)=>b+=`${x.type==="income"?"🟢":"🔴"} ${x.description||"Movimentação"}: *${money(x.amount)}*\n`);const o=await reply(b);await done(aid,"extracted",o);return new Response("OK")}
if(n==="/saldo"){await save(phone,"SALDO_CTX",{});const o=await reply("📊 *Visualizar saldo:*\n*1* - 🏢 Empresa\n*2* - 👤 Pessoal\n*3* - 🌐 Todos");await done(aid,"extracted",o);return new Response("OK")}
if(n==="/resumo"){await save(phone,"RESUMO_CTX",{});const o=await reply("📋 *Extrato rápido:*\n*1* - 🏢 Empresa\n*2* - 👤 Pessoal\n*3* - 🌐 Todos");await done(aid,"extracted",o);return new Response("OK")}
/* V173_FINANCE_PLANNING_BOT_START — consulta de planejamento, read-only */
if(/^(?:\/?planejamento(?: financeiro)?|\/?planejar|\/?reservas(?: planejadas)?|meu planejamento)(?:\s|$)/.test(n)){
  const planToday=day();
  const [year,month]=planToday.slice(0,7).split('-').map(Number);
  const prevStart=new Date(Date.UTC(year,month-2,1,12)).toISOString().slice(0,7)+'-01';
  const contextFilter=pendingFilters(text).context;
  const contexts:('dfl'|'personal')[]=contextFilter==='dfl'?['dfl']:contextFilter==='personal'?['personal']:['dfl','personal'];
  const [settingsResult,rowsResult,categoriesResult]=await Promise.all([
    db.from('user_settings').select('preferences').eq('user_id',u.user_id).maybeSingle(),
    db.from('transactions').select('context,date,type,amount,status,affects_balance,category_id,credit_card_id,invoice_id,transfer_group_id,goal_id,loan_id,financing_id,debt_id')
      .eq('user_id',u.user_id).gte('date',prevStart).lte('date',planToday).order('date',{ascending:false}).limit(1800),
    db.from('categories').select('id,name,context').eq('user_id',u.user_id).limit(500),
  ]);
  if(settingsResult.error||rowsResult.error||categoriesResult.error){
    const o=await reply('Não consegui consultar o planejamento agora. Tente novamente no aplicativo.');
    await done(aid,'extracted',o,{action:'query.planning.unavailable'});
    return new Response('OK');
  }
  const preferences=settingsResult.data?.preferences||{};
  const rows=rowsResult.data||[],cats=categoriesResult.data||[];
  const blocks=contexts.map(context=>{
    const plan=buildFinancePlanning(rows,cats.filter((c:any)=>c.context===context),context,planToday,
      preferences.planning_groups,preferences.planning_reserves,preferences.planning_flex_limits);
    const remaining=plan.flexibleRemaining===null?'não configurado':money(plan.flexibleRemaining);
    const headlines=plan.reserves.filter(x=>x.outstanding>0).slice(0,3).map(x=>`• ${x.name}: ${money(x.monthlySuggested)}/mês, até ${x.target_date}`);
    return `*${context==='dfl'?'Empresa':'Pessoal'}*\n🏠 Fixos: *${money(plan.spent.fixed)}*\n🛒 Flexíveis: *${money(plan.spent.flex)}*\n📆 Não mensais: *${money(plan.spent.irregular)}*\n🎯 Restante do limite flexível: *${remaining}*\n🐷 Reserva mensal sugerida: *${money(plan.reserveMonthlySuggested)}*${headlines.length?'\n'+headlines.join('\n'):''}`;
  });
  const partial=rows.length>=1800||cats.length>=500?'\n⚠️ Consulta parcial pelo limite de registros.':'';
  const message=`🧠 *Plano Financeiro — ${planToday.slice(0,7)}*\n\n${blocks.join('\n\n')}\n\n_Planejamento e limites não são saldo bancário. Reservas são declarações manuais; nenhuma movimentação foi feita._${partial}`;
  const o=await reply(message);
  await done(aid,'extracted',o,{action:'query.planning.readonly',contexts,partial:Boolean(partial),count:rows.length});
  return new Response('OK');
}
/* V173_FINANCE_PLANNING_BOT_END */
/* V172_FINANCE_PACE_BOT_START — consulta econômica; zero mutação de saldo */
if(/^(?:\/ritmo|ritmo(?: financeiro)?|meu ritmo|como estao os gastos|como andam os gastos|controle de gastos)(?:\s|$)/.test(n)){
  const pulseToday=day();
  const [pulseYear,pulseMonth]=pulseToday.slice(0,7).split('-').map(Number);
  const pulsePrev=new Date(Date.UTC(pulseYear,pulseMonth-2,1,12)).toISOString().slice(0,7)+'-01';
  const pulseContextRaw=pendingFilters(text).context;
  const pulseContext:'dfl'|'personal'|null=pulseContextRaw==='dfl'?'dfl':pulseContextRaw==='personal'?'personal':null;
  let pulseQuery=db.from('transactions')
    .select('date,context,type,amount,status,affects_balance,credit_card_id,invoice_id,transfer_group_id,goal_id,loan_id,financing_id,debt_id,category_id')
    .eq('user_id',u.user_id).gte('date',pulsePrev).lte('date',pulseToday)
    .order('date',{ascending:false}).limit(1800);
  if(pulseContext)pulseQuery=pulseQuery.eq('context',pulseContext);
  const [pulseResult,pulsePrefs]=await Promise.all([
    pulseQuery,
    db.from('user_settings').select('preferences').eq('user_id',u.user_id).maybeSingle()
  ]);
  if(pulseResult.error)throw pulseResult.error;
  const pulseRows=pulseResult.data||[];
  const configuredLimits=pulsePrefs.data?.preferences?.spending_limits||{};
  const scopes:("dfl"|"personal")[]=pulseContext?[pulseContext]:['dfl','personal'];
  const pulsePhrases=scopes.map(scope=>{
    const snap=buildFinancePace(pulseRows,scope,pulseToday,Number(configuredLimits[scope]||0));
    const change=snap.previousPeriodChange===null?'sem base anterior':`${snap.previousPeriodChange>=0?'+':''}${snap.previousPeriodChange.toFixed(1)}%`;
    const target=snap.monthlyLimit===null?'não configurado':money(snap.monthlyLimit);
    const rest=snap.remainingLimit===null?'sem limite':money(snap.remainingLimit);
    return `*${scope==='dfl'?'Empresa':'Pessoal'}*\n🔴 Gasto neste mês: *${money(snap.currentExpense)}*\n📆 Últimos 7 dias: ${money(snap.weekExpense)}\n📊 Vs. mesmos dias do mês anterior: ${change}\n🎯 Limite: ${target}\n📏 Resta no limite: ${rest}${snap.projectedExpense!==null?`\n🔭 Estimativa linear do mês: ${money(snap.projectedExpense)}`:'\n🔭 Poucos dados para extrapolar.'}`;
  });
  const note=pulseRows.length>=1800?'\n⚠️ Consulta parcial: limite de 1.800 lançamentos.':'';
  const message=`📊 *Ritmo Financeiro — ${pulseToday.slice(0,7)}*\n\n${pulsePhrases.join('\n\n')}\n\n_Comparação de gastos econômicos realizados; compras de cartão contam na compra, não na fatura. Isso não é saldo bancário. Nenhum lançamento foi alterado._${note}`;
  const pulseReply=await reply(message);
  await done(aid,'extracted',pulseReply,{action:'query.spending_pace.readonly',context:pulseContext||'both',count:pulseRows.length,partial:pulseRows.length>=1800});
  return new Response('OK');
}
/* V172_FINANCE_PACE_BOT_END */
/* V171_FINANCE_COMPARE_START — consultas determinísticas sem ações financeiras */
const compareIntent=parseFinanceComparison(n,day());
if(compareIntent){
  if(compareIntent.kind==='invalid'){
    const out=await reply(`📊 *Comparativo Financeiro*\n\n${compareIntent.reason}\n\nExemplos:\n• comparar setembro e outubro empresa\n• comparar 09/2026 e 10/2026 pessoal\n• evolução últimos 6 meses`);
    await done(aid,'extracted',out,{action:'compare.invalid.readonly'});
    return new Response('OK');
  }
  const selected=compareIntent.months;
  const start=selected[0]+'-01',last=selected[selected.length-1];
  const [year,month]=last.split('-').map(Number);
  const end=new Date(Date.UTC(year,month,0,12)).toISOString().slice(0,10);
  const actualEnd=end>day()?day():end;
  let query=db.from("transactions").select("date,context,type,amount,status,affects_balance,credit_card_id,invoice_id,transfer_group_id,goal_id,loan_id,financing_id,debt_id")
    .eq("user_id",u.user_id).eq("status","done").eq("affects_balance",true)
    .in("type",["income","expense","sangria"])
    .gte("date",start).lte("date",actualEnd).order("date",{ascending:false}).limit(1200);
  if(compareIntent.context)query=query.eq("context",compareIntent.context);
  const result=await query;
  if(result.error)throw result.error;
  const rows=result.data||[];
  const totals=aggregateFinanceMonths(rows,selected,compareIntent.context);
  const incomplete=rows.length>=1200;
  const contextTitle=compareIntent.context==='dfl'?'Empresa':compareIntent.context==='personal'?'Pessoal':'Empresa + Pessoal';
  const prefix=compareIntent.kind==='compare'?`📊 *Comparativo · ${contextTitle}*`:`📈 *Evolução financeira · ${contextTitle}*`;
  let content=prefix+'\n\n'+totals.map((m:any)=>`*${monthLabel(m.month)}*\n🟢 Entradas: *${money(m.income)}*\n🔴 Saídas: *${money(m.expense)}*\n💰 Resultado: *${money(m.net)}* · ${m.count} lançamentos`).join('\n\n');
  if(compareIntent.kind==='compare'){
    const first=totals[0],second=totals[1];
    content+=`\n\n*Variação do segundo mês em relação ao primeiro*\n🔴 Saídas: *${financeCompareDelta(second.expense,first.expense)}*\n🟢 Entradas: *${financeCompareDelta(second.income,first.income)}*`;
  }else{
    const first=totals[0],lastRow=totals[totals.length-1];
    content+=`\n\n*Ritmo das saídas*\n${monthLabel(first.month)} → ${monthLabel(lastRow.month)}: *${financeCompareDelta(lastRow.expense,first.expense)}*`;
  }
  const partialMonth=selected.includes(day().slice(0,7));
  content+=`\n\n_Somente caixa realizado, sem cartão, faturas, transferências, metas ou pendências. Isso não é saldo bancário.${partialMonth?' O mês atual está incompleto.':''}${incomplete?' ⚠️ Consulta parcial: limite de 1.200 movimentações.':''} Nenhum dado foi modificado._`;
  const response=await reply(content);
  await done(aid,'extracted',response,{action:compareIntent.kind==='compare'?'compare.periods.readonly':'compare.trend.readonly',context:compareIntent.context||'all',months:selected,count:rows.length,incomplete});
  return new Response('OK');
}
/* V171_FINANCE_COMPARE_END */
/* V169_FINANCIAL_RADAR_START — somente consultas read-only; nenhuma mutacao de saldo */
if(/^(?:\/radar|radar financeiro|raio x|raio-x|diagnostico financeiro|revisao semanal|onde economizar)(?:\s+(?:empresa|pessoal))?$/.test(n)){
  const context=/\bpessoal\b/.test(n)?"personal":/\bempresa\b/.test(n)?"dfl":null;
  const today=day(),begin=botShiftCivil(today,-13),split=botShiftCivil(today,-6);
  let query=db.from("transactions").select("type,amount,description,date,context").eq("user_id",u.user_id)
    .eq("status","done").eq("affects_balance",true).is("goal_id",null).is("transfer_group_id",null)
    .is("invoice_id",null).is("credit_card_id",null).in("type",["income","expense","sangria"])
    .gte("date",begin).lte("date",today).order("date",{ascending:false}).limit(900);
  if(context)query=query.eq("context",context);
  const result=await query;
  if(result.error)throw result.error;
  const rows=result.data||[],a={income:0,expense:0},b={income:0,expense:0},expenses:any[]=[];
  for(const row of rows){
    const amount=Number(row.amount||0);if(!Number.isFinite(amount)||amount<=0)continue;
    const bucket=row.date>=split?a:b;
    if(row.type==="income")bucket.income+=amount;
    else{bucket.expense+=amount;if(row.date>=split)expenses.push(row)}
  }
  expenses.sort((x:any,y:any)=>Number(y.amount||0)-Number(x.amount||0));
  const diff=a.expense-b.expense;
  const trend=b.expense>0?`${diff>=0?"+":""}${Math.round(diff/b.expense*100)}%`:(a.expense>0?"sem base anterior":"estável");
  const title=context==="personal"?"Pessoal":context==="dfl"?"Empresa":"Empresa + Pessoal";
  const top=expenses.slice(0,3).map((x:any,i:number)=>`${i+1}. ${String(x.description||"Despesa").slice(0,55)}: *${money(x.amount)}*`).join("\n");
  const incomplete=rows.length>=900;
  const output=`🔎 *Radar Financeiro · ${title}*\n\n*Últimos 7 dias (${split} a ${today})*\n🟢 Entradas realizadas: *${money(a.income)}*\n🔴 Saídas realizadas: *${money(a.expense)}*\n📊 Resultado: *${money(a.income-a.expense)}*\n\n*7 dias anteriores*\n🔴 Saídas: *${money(b.expense)}*\n📈 Variação de despesas: *${trend}*${top?`\n\n*3 maiores saídas recentes*\n${top}`:""}\n\n_Dados realizados de caixa. Não inclui cartão, faturas, transferências ou pendentes.${incomplete?" Consulta limitada às 900 movimentações recentes.":""} Nenhum lançamento foi alterado._`;
  const replyText=await reply(output);
  await done(aid,"extracted",replyText,{action:"radar.readonly",context:context||"all",days:14,incomplete,rows:rows.length});
  return new Response("OK");
}
/* V169_FINANCIAL_RADAR_END */

if(n==="/relatorio"){const start=`${day().slice(0,8)}01`,r=await db.from("transactions").select("amount,type").eq("user_id",u.user_id).eq("status","done").eq("affects_balance",true).is("goal_id",null).in("type",["income","expense","sangria"]).gte("date",start).lte("date",day());let inc=0,exp=0;(r.data||[]).forEach((x:any)=>x.type==="income"?inc+=Number(x.amount):exp+=Number(x.amount));const o=await reply(`📈 *Resumo do mês*\n\n🟢 Receitas: *${money(inc)}*\n🔴 Despesas: *${money(exp)}*\n💰 Resultado: *${money(inc-exp)}*`);await done(aid,"extracted",o);return new Response("OK")}
if(/quanto tenho (?:na|no|em) /.test(n)){const wanted=n.replace(/^.*quanto tenho (?:na|no|em) /,"").replace(/[?!.]+$/,"").trim(),aa=await allAccs(u.user_id),a=matchNamed(aa,wanted);const o=await reply(a?`🏦 *${a.name}*\nSaldo atual: *${money(a.balance)}*`:`Não encontrei a conta *${wanted}*.`);await done(aid,"extracted",o,{query:"account_balance"});return new Response("OK")}
if(/contas? (?:estao |esta )?negativ/.test(n)){const aa=(await allAccs(u.user_id)).filter((x:any)=>Number(x.balance)<0);const o=await reply(aa.length?`🔴 *Contas negativas*\n\n${aa.map((x:any)=>`• *${x.name}:* ${money(x.balance)}`).join("\n")}`:"✅ *Nenhuma conta está negativa.*");await done(aid,"extracted",o,{query:"negative_accounts"});return new Response("OK")}
if(/quanto tenho.*(?:empresa|dfl)|total.*(?:empresa|dfl)/.test(n)){const aa=(await allAccs(u.user_id)).filter((x:any)=>x.context==="dfl"),total=aa.reduce((sum:number,x:any)=>sum+Number(x.balance||0),0);const o=await reply(`🏢 *Saldo total da empresa*\n\n💰 *${money(total)}*\n${aa.length} contas consideradas.`);await done(aid,"extracted",o,{query:"dfl_total"});return new Response("OK")}
if(/maiores despesas/.test(n)){const p=pendingPeriod(text),pf=pendingFilters(text);let q=db.from("transactions").select("description,amount,date,context").eq("user_id",u.user_id).in("type",["expense","sangria"]).eq("status","done").eq("affects_balance",true).gte("date",p.start).lte("date",p.end);if(pf.context)q=q.eq("context",pf.context);const r=await q.order("amount",{ascending:false}).limit(5),rows=r.data||[],ctx=pf.context==="dfl"?" · Empresa":pf.context==="personal"?" · Pessoal":"";const o=await reply(rows.length?`📉 *5 maiores despesas — ${p.label}${ctx}*\n\n${rows.map((x:any,i:number)=>`*${i+1}.* ${x.description||"Despesa"} — *${money(x.amount)}* · ${x.date}`).join("\n")}`:`Não encontrei despesas realizadas em *${p.label}${ctx}*.`);await done(aid,"extracted",o,{action:"query.top_expenses",period:p,context:pf.context,count:rows.length});return new Response("OK")}
if(/quanto (?:entrou|recebi|faturei).*hoje/.test(n)){const r=await db.from("transactions").select("amount").eq("user_id",u.user_id).eq("type","income").eq("status","done").eq("affects_balance",true).eq("date",day()),total=(r.data||[]).reduce((sum:number,x:any)=>sum+Number(x.amount||0),0);const o=await reply(`🟢 *Entradas de hoje*\n\n💰 *${money(total)}*`);await done(aid,"extracted",o,{query:"income_today"});return new Response("OK")}
if(/^(quem (me )?deve|quem esta me devendo|valores? a receber)/.test(n)){const q=await db.from("debts").select("id,person_name,total_amount,paid_amount,due_date,status,context").eq("user_id",u.user_id).in("status",["pending","partial"]).order("due_date",{ascending:true,nullsFirst:false}).limit(10),items=q.data||[];if(!items.length){const o=await reply("✅ *Ninguém está te devendo no momento.*");await done(aid,"extracted",o,{action:"receivable.list"});return new Response("OK")}const today=day(),body=items.map((d:any,i:number)=>{const rem=Math.max(0,Number(d.total_amount||0)-Number(d.paid_amount||0)),late=d.due_date&&d.due_date<today?" ⚠️ atrasado":"";return `*${i+1}* — 👤 ${d.person_name} · *${money(rem)}*${d.due_date?` · ${d.due_date}${late}`:""}`}).join("\n");await save(phone,"DEBT_PAY_PICK",{items});const o=await reply(`👥 *Quem me deve*\n\n${body}\n\nDigite o número para gerenciar a cobrança: receber, alterar vencimento, nome ou valor.`);await done(aid,"extracted",o,{action:"receivable.list",count:items.length});return new Response("OK")}
const debtDueDirect=text.match(/^(.+?)\s+(?:vence|vencimento)\s+(?:em\s+)?(0?[1-9]|[12]\d|3[01])[\/-](0?[1-9]|1[0-2])(?:[\/-](\d{2}|\d{4}))?$/i);
if(debtDueDirect){const name=debtDueDirect[1].trim(),yy=debtDueDirect[4]?Number(debtDueDirect[4].length===2?"20"+debtDueDirect[4]:debtDueDirect[4]):Number(day().slice(0,4)),mm=Number(debtDueDirect[3]),dd=Number(debtDueDirect[2]),x=new Date(Date.UTC(yy,mm-1,dd,12));if(x.getUTCFullYear()!==yy||x.getUTCMonth()!==mm-1||x.getUTCDate()!==dd){const o=await reply("Essa data não é válida.");await done(aid,"extracted",o);return new Response("OK")}const due=`${yy}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`,friendly=`${String(dd).padStart(2,"0")}/${String(mm).padStart(2,"0")}/${yy}`,q=await db.from("debts").select("id,person_name,total_amount,paid_amount,due_date,status,context").eq("user_id",u.user_id).in("status",["pending","partial"]).ilike("person_name",`%${name}%`).limit(10),items=q.data||[];if(!items.length){const o=await reply(`Não encontrei cobrança aberta para *${name}*.`);await done(aid,"extracted",o);return new Response("OK")}if(items.length>1){await save(phone,"DEBT_DUE_PICK",{items,new_due:due,friendly});const o=await reply(`Encontrei mais de uma cobrança para *${name}*:\n\n${items.map((d:any,i:number)=>`*${i+1}* — ${money(Math.max(0,Number(d.total_amount)-Number(d.paid_amount||0)))} · ${d.due_date||"sem vencimento"}`).join("\n")}\n\nQual delas terá o vencimento alterado para *${friendly}*?`);await done(aid,"extracted",o);return new Response("OK")}await save(phone,"DEBT_DUE_CONFIRM",{debt:items[0],new_due:due,friendly});const o=await reply(`📅 *Alterar vencimento*\n\n👤 *${items[0].person_name}*\nDe: *${items[0].due_date||"sem data"}*\nPara: *${friendly}*\n\n*1* — Confirmar\n*2* — Cancelar`);await done(aid,"extracted",o,{action:"receivable.update_due_direct_preview"});return new Response("OK")}
const debtAsk=n.match(/^(?:quanto\s+)?(.+?)\s+(?:ainda\s+)?(?:me\s+deve|deve\s+pra\s+mim)[?!.]*$/);
if(debtAsk&&!/\d/.test(debtAsk[1])){const name=debtAsk[1].replace(/^quanto\s+/,"").trim(),q=await db.from("debts").select("person_name,total_amount,paid_amount,due_date,status").eq("user_id",u.user_id).in("status",["pending","partial"]).ilike("person_name",`%${name}%`).order("due_date",{ascending:true,nullsFirst:false}).limit(10),items=q.data||[];if(!items.length){const o=await reply(`Não encontrei cobrança aberta para *${name}*.`);await done(aid,"extracted",o);return new Response("OK")}const total=items.reduce((a:number,d:any)=>a+Math.max(0,Number(d.total_amount||0)-Number(d.paid_amount||0)),0),o=await reply(`👤 *${items[0].person_name}*\n\n💰 Ainda falta receber: *${money(total)}*${items.length>1?`\n🧾 ${items.length} cobranças abertas`:""}\n${items.map((d:any)=>`• ${money(Math.max(0,Number(d.total_amount||0)-Number(d.paid_amount||0)))} · ${d.due_date||"sem vencimento"}`).join("\n")}`);await done(aid,"extracted",o,{action:"receivable.person_balance",count:items.length,total});return new Response("OK")}
const paid=n.match(/^(.+?)\s+me\s+pagou(?:\s+(?:r\$\s*)?([\d.,]+))?/);if(paid){const name=paid[1].trim(),q=await db.from("debts").select("id,person_name,total_amount,paid_amount,due_date,status,context").eq("user_id",u.user_id).in("status",["pending","partial"]).ilike("person_name",`%${name}%`).limit(10),items=q.data||[];if(!items.length){const o=await reply(`Não encontrei cobrança aberta para *${name}*.`);await done(aid,"extracted",o);return new Response("OK")}if(items.length>1){await save(phone,"DEBT_PAY_PICK",{items});const o=await reply(`Encontrei mais de uma cobrança para *${name}*:\n\n${items.map((d:any,i:number)=>`*${i+1}* — ${money(Math.max(0,Number(d.total_amount)-Number(d.paid_amount||0)))} · ${d.due_date||"sem vencimento"}`).join("\n")}\n\nQual delas?`);await done(aid,"extracted",o);return new Response("OK")}const d=items[0],rem=Math.max(0,Number(d.total_amount)-Number(d.paid_amount||0)),v=paid[2]?amount(paid[2]):0;if(v){const pay_date=explicitDate(text)||(/\b(hoje|ontem|anteontem)\b/.test(n)?naturalDate(text):day()),aa=await accs(u.user_id,d.context);await save(phone,"DEBT_PAY_ACC",{debt:d,pay_amount:v,pay_date,accounts:aa});const o=await reply(list(aa,`💵 *${d.person_name} pagou ${money(v)}*\n\nEm qual conta entrou?`,true));await done(aid,"extracted",o);return new Response("OK")}await save(phone,"DEBT_PAY_AMOUNT",{debt:d});const o=await reply(`👤 *${d.person_name}* ainda deve *${money(rem)}*.\n\nQuanto foi pago? Digite *quitar* para receber tudo.`);await done(aid,"extracted",o);return new Response("OK")}
if(/^(minhas? assinaturas|assinaturas|ver assinaturas)/.test(n)){const q=await db.from("subscriptions").select("id,name,amount,due_day,next_due_date,status,context").eq("user_id",u.user_id).neq("status","cancelled").order("next_due_date",{ascending:true,nullsFirst:false}).limit(15),items=q.data||[];if(!items.length){const o=await reply("🔁 Você não tem assinaturas cadastradas.");await done(aid,"extracted",o,{action:"subscription.list"});return new Response("OK")}await save(phone,"SUB_PICK",{items});const o=await reply(`🔁 *Assinaturas*\n\n${items.map((x:any,i:number)=>`*${i+1}* — ${x.status==="paused"?"⏸️":"🟢"} *${x.name}* · ${money(x.amount)} · ${x.next_due_date||`dia ${x.due_day}`}`).join("\n")}\n\nDigite o número para gerenciar.`);await done(aid,"extracted",o,{action:"subscription.list",count:items.length});return new Response("OK")}
const findTx=n.match(/^(?:buscar|procurar|achar) (?:transacao|transação|movimentacao|movimentação)\s+(.+)/);if(findTx){const term=findTx[1].trim(),q=await db.from("transactions").select("description,amount,type,date,status,context").eq("user_id",u.user_id).ilike("description",`%${term}%`).order("date",{ascending:false}).limit(10),rows=q.data||[];const o=await reply(rows.length?`🔎 *Movimentações encontradas*\n\n${rows.map((x:any)=>`${x.type==="income"?"🟢":"🔴"} ${x.description||"Movimentação"} · *${money(x.amount)}* · ${x.date} · ${x.status==="done"?"realizada":"pendente"}`).join("\n")}`:`Não encontrei movimentações com *${term}*.`);await done(aid,"extracted",o,{action:"transaction.search",count:rows.length});return new Response("OK")}
if(/(?:como|quanto).*(?:mes passado|mês passado).*(?:este mes|esse mes|este mês|esse mês)|(?:este mes|esse mes|este mês|esse mês).*(?:mes passado|mês passado)/.test(n)){const now=new Date(),y=Number(day().slice(0,4)),m=Number(day().slice(5,7)),prevM=m===1?12:m-1,prevY=m===1?y-1:y,curStart=`${y}-${String(m).padStart(2,"0")}-01`,prevStart=`${prevY}-${String(prevM).padStart(2,"0")}-01`,prevEnd=new Date(Date.UTC(y,m-1,0)).toISOString().slice(0,10),q=await db.from("transactions").select("amount,type,date").eq("user_id",u.user_id).eq("status","done").eq("affects_balance",true).in("type",["income","expense","sangria"]).gte("date",prevStart).lte("date",day()),rows=q.data||[];const sum=(from:string,to:string,type:string)=>(rows.filter((x:any)=>x.date>=from&&x.date<=to&&(type==="income"?x.type==="income":x.type!=="income"))).reduce((a:number,x:any)=>a+Number(x.amount||0),0),ci=sum(curStart,day(),"income"),ce=sum(curStart,day(),"expense"),pi=sum(prevStart,prevEnd,"income"),pe=sum(prevStart,prevEnd,"expense"),pct=(a:number,b:number)=>b===0?null:((a-b)/Math.abs(b))*100;const di=pct(ci,pi),de=pct(ce,pe),fmt=(v:number|null)=>v===null?"sem base anterior":`${v>=0?"+":""}${v.toFixed(1)}%`;const o=await reply(`📊 *Este mês × mês passado*\n\n🟢 Receitas: *${money(ci)}* vs ${money(pi)} · ${fmt(di)}\n🔴 Despesas: *${money(ce)}* vs ${money(pe)} · ${fmt(de)}\n💰 Resultado atual: *${money(ci-ce)}*\n💰 Resultado anterior: *${money(pi-pe)}*`);await done(aid,"extracted",o,{action:"query.month_compare"});return new Response("OK")}
if(/quanto (?:ainda )?tenho (?:para|pra) receber|quanto (?:ainda )?falta receber|total a receber/.test(n)){const q=await db.from("debts").select("total_amount,paid_amount,due_date").eq("user_id",u.user_id).in("status",["pending","partial"]),rows=q.data||[],total=rows.reduce((a:number,d:any)=>a+Math.max(0,Number(d.total_amount||0)-Number(d.paid_amount||0)),0),late=rows.filter((d:any)=>d.due_date&&d.due_date<day()),lateTotal=late.reduce((a:number,d:any)=>a+Math.max(0,Number(d.total_amount||0)-Number(d.paid_amount||0)),0);const out=await reply(`👥 *Valores a receber*\n\n💰 Total em aberto: *${money(total)}*\n🧾 ${rows.length} cobranças abertas\n⚠️ Atrasado: *${money(lateTotal)}* em ${late.length} cobranças`);await done(aid,"extracted",out,{action:"query.receivables_total"});return new Response("OK")}
/* V170_UNIFIED_AGENDA_BOT_START: somente consultas, sem RPC financeiro */
if(/^(?:\/?agenda(?: financeira)?|o que vence|oque vence|proximos vencimentos|proximas contas)\b/.test(n)){
  const period=n.match(/\b(7|15|30|90)\s*dias?\b/);
  const days=period?Number(period[1]):7;
  const start=day(),end=botShiftCivil(start,days-1);
  const pf=pendingFilters(text);
  let tq=db.from('transactions')
    .select('id,amount,type,description,date,due_date,context')
    .eq('user_id',u.user_id).eq('status','pending').eq('affects_balance',false)
    .in('type',['expense','income','sangria'])
    .is('transfer_group_id',null).is('credit_card_id',null)
    .is('invoice_id',null).is('debt_id',null).is('financing_id',null)
    .is('loan_id',null).is('goal_id',null)
    .gte('date',start).lte('date',end);
  let sq=db.from('subscriptions')
    .select('name,amount,next_due_date,context')
    .eq('user_id',u.user_id).eq('status','active')
    .gte('next_due_date',start).lte('next_due_date',end);
  let dq=db.from('debts')
    .select('person_name,total_amount,paid_amount,due_date,context')
    .eq('user_id',u.user_id).in('status',['pending','partial'])
    .gte('due_date',start).lte('due_date',end);
  if(pf.context){
    tq=tq.eq('context',pf.context);
    sq=sq.eq('context',pf.context);
    dq=dq.eq('context',pf.context);
  }
  const [tqResult,sqResult,dqResult]=await Promise.all([
    tq.order('date',{ascending:true}).limit(60),
    sq.order('next_due_date',{ascending:true}).limit(60),
    dq.order('due_date',{ascending:true}).limit(60)
  ]);
  if(tqResult.error||sqResult.error||dqResult.error)throw(tqResult.error||sqResult.error||dqResult.error);
  const txRows=tqResult.data||[], subRows=sqResult.data||[], debtRows=dqResult.data||[];
  const pay=txRows.filter((x:any)=>x.type==='expense'||x.type==='sangria');
  const inc=txRows.filter((x:any)=>x.type==='income');
  const sum=(xs:any[],key:string)=>xs.reduce((total:number,x:any)=>total+Math.max(0,Number(x[key]||0)),0);
  const expectedReceivable=debtRows.reduce((total:number,x:any)=>total+Math.max(0,Number(x.total_amount||0)-Number(x.paid_amount||0)),0);
  const short=(xs:any[],dateField:string,labelField:string,calc:(x:any)=>number)=>xs.slice(0,5)
    .map((x:any)=>`• ${String(x[labelField]||'Sem descrição').slice(0,60)} · ${money(calc(x))} · ${x[dateField]||'sem data'}`).join('\n');
  const ctx=pf.context==='personal'?'Pessoal':pf.context==='dfl'?'Empresa':'Empresa + Pessoal';
  const limited=txRows.length>=60||subRows.length>=60||debtRows.length>=60;
  const message=`📅 *Agenda · próximos ${days} dias · ${ctx}*\n\n`+
    `*Compromissos pendentes conhecidos*\n`+
    `🔴 A pagar: *${money(sum(pay,'amount'))}* (${pay.length})\n`+
    `🟢 Receitas ainda não recebidas: *${money(sum(inc,'amount'))}* (${inc.length})\n`+
    `${pay.length?short(pay,'due_date','description',(x:any)=>Number(x.amount)):'• Nenhum pagamento simples no período'}\n\n`+
    `*Cobranças em aberto*\n`+
    `💚 A receber: *${money(expectedReceivable)}* (${debtRows.length})\n`+
    `${debtRows.length?short(debtRows,'due_date','person_name',(x:any)=>Math.max(0,Number(x.total_amount)-Number(x.paid_amount||0))):'• Nenhuma cobrança no período'}\n\n`+
    `*Assinaturas previstas — separadas*\n`+
    `🟣 Planejamento: *${money(sum(subRows,'amount'))}* (${subRows.length})\n`+
    `${subRows.length?short(subRows,'next_due_date','name',(x:any)=>Number(x.amount)):'• Nenhuma assinatura'}\n\n`+
    `_As assinaturas não foram somadas aos compromissos para evitar duplicidade. Os valores a receber não são saldo. O bot não somou faturas, empréstimos ou financiamentos nesta consulta; confira a Agenda completa no aplicativo.${limited?' O limite de 60 registros por grupo pode deixar esta consulta parcial.':''} Nenhum valor foi movimentado._`;
  const sent=await reply(message);
  await done(aid,'extracted',sent,{action:'agenda.unified.readonly',days,context:pf.context||'all',count:txRows.length+subRows.length+debtRows.length,partial:limited});
  return new Response('OK');
}
/* V170_UNIFIED_AGENDA_BOT_END */
if(/(?:assinaturas|recorrencias|recorrências).*(?:proximos 7 dias|próximos 7 dias|semana)|quanto.*(?:assinaturas|recorrencias|recorrências).*(?:semana|7 dias)/.test(n)){const start=day(),base=new Date(`${start}T12:00:00-03:00`);base.setDate(base.getDate()+7);const end=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(base),q=await db.from("subscriptions").select("name,amount,next_due_date").eq("user_id",u.user_id).eq("status","active").gte("next_due_date",start).lte("next_due_date",end).order("next_due_date"),rows=q.data||[],total=rows.reduce((a:number,x:any)=>a+Number(x.amount||0),0);const out=await reply(rows.length?`📅 *Assinaturas — próximos 7 dias*\n\n💰 Total previsto: *${money(total)}*\n${rows.map((x:any)=>`• *${x.name}* · ${money(x.amount)} · ${x.next_due_date}`).join("\n")}`:"✅ *Nenhuma assinatura ativa vence nos próximos 7 dias.*");await done(aid,"extracted",out,{action:"query.subscriptions_7d",count:rows.length});return new Response("OK")}
// Financial period intelligence: one parser for month/year + optional Empresa/Pessoal context.
if(/^(?:resumo(?: financeiro)?|quanto (?:eu )?gastei|quanto (?:eu )?recebi|extrato)\b/.test(n)&&pendingPeriod(text).explicit){
  const p=pendingPeriod(text),pf=pendingFilters(text);
  let q=db.from("transactions").select("id,amount,type,description,date,status,affects_balance,context,receipt_url").eq("user_id",u.user_id).gte("date",p.start).lte("date",p.end);
  if(pf.context)q=q.eq("context",pf.context);
  const r=await q.order("date",{ascending:false}).limit(250),rows=r.data||[],done=rows.filter((x:any)=>x.status==="done"&&x.affects_balance===true),pending=rows.filter((x:any)=>x.status==="pending"&&x.affects_balance===false),inc=done.filter((x:any)=>x.type==="income").reduce((a:number,x:any)=>a+Number(x.amount||0),0),out=done.filter((x:any)=>x.type==="expense"||x.type==="sangria").reduce((a:number,x:any)=>a+Number(x.amount||0),0),ctx=pf.context==="dfl"?" · Empresa":pf.context==="personal"?" · Pessoal":"";
  if(/^quanto (?:eu )?gastei\b/.test(n)){const o=await reply(`🔴 *Despesas — ${p.label}${ctx}*\n\nRealizado: *${money(out)}*\n🕒 Pendências no período: *${pending.filter((x:any)=>x.type==="expense"||x.type==="sangria").length}*`);await done(aid,"extracted",o,{action:"query.period_expenses",period:p,context:pf.context,total:out});return new Response("OK")}
  if(/^quanto (?:eu )?recebi\b/.test(n)){const o=await reply(`🟢 *Receitas — ${p.label}${ctx}*\n\nRealizado: *${money(inc)}*\n🕒 Pendências no período: *${pending.filter((x:any)=>x.type==="income").length}*`);await done(aid,"extracted",o,{action:"query.period_income",period:p,context:pf.context,total:inc});return new Response("OK")}
  if(/^extrato\b/.test(n)){const items=rows.slice(0,15);const o=await reply(items.length?`📋 *Extrato — ${p.label}${ctx}*\n\n${items.map((x:any)=>`${x.status==="pending"?"🕒":x.type==="income"?"🟢":"🔴"} *${money(x.amount)}* · ${x.description||"Movimentação"} · ${x.date}${x.receipt_url?" · 📎":""}`).join("\n")}\n\n${rows.length>15?`_Mostrando 15 de ${rows.length} movimentações encontradas._`:""}`:`📋 Nenhuma movimentação em *${p.label}${ctx}*.`);await done(aid,"extracted",o,{action:"query.period_statement",period:p,context:pf.context,count:rows.length});return new Response("OK")}
  const o=await reply(`📊 *Resumo — ${p.label}${ctx}*\n\n🟢 Receitas realizadas: *${money(inc)}*\n🔴 Despesas realizadas: *${money(out)}*\n💰 Resultado realizado: *${money(inc-out)}*\n🕒 Pendências: *${pending.length}*\n🧾 Movimentações realizadas: *${done.length}*\n\n_Tente também: “extrato ${p.label}”, “quanto gastei ${p.label}” ou “quanto recebi ${p.label}”._`);await done(aid,"extracted",o,{action:"query.period_summary",period:p,context:pf.context,income:inc,expenses:out,pending:pending.length});return new Response("OK")
}
if(/^(resumo de hoje|meu resumo de hoje|como estou hoje|como estao minhas financas hoje|como estão minhas finanças hoje)$/.test(n)){const t=day(),q=await db.from("transactions").select("amount,type,status,affects_balance,context").eq("user_id",u.user_id).eq("date",t),rows=q.data||[],real=rows.filter((x:any)=>x.status==="done"&&x.affects_balance===true),inc=real.filter((x:any)=>x.type==="income").reduce((a:number,x:any)=>a+Number(x.amount||0),0),out=real.filter((x:any)=>x.type==="expense"||x.type==="sangria").reduce((a:number,x:any)=>a+Number(x.amount||0),0),pend=rows.filter((x:any)=>x.status==="pending"&&x.affects_balance===false),dfl=real.filter((x:any)=>x.context==="dfl"),personal=real.filter((x:any)=>x.context==="personal"),o=await reply(`📆 *Resumo de hoje*\n\n🟢 Entradas realizadas: *${money(inc)}*\n🔴 Saídas realizadas: *${money(out)}*\n📊 Resultado do dia: *${money(inc-out)}*\n🕒 Pendências: *${pend.length}*\n\n🏢 Empresa: ${dfl.length} movimentações realizadas\n👤 Pessoal: ${personal.length} movimentações realizadas`);await done(aid,"extracted",o,{action:"query.today_summary",pending:pend.length});return new Response("OK")}
if(/como esta a empresa hoje|como está a empresa hoje|resumo da empresa hoje|empresa hoje/.test(n)){const aa=(await allAccs(u.user_id)).filter((x:any)=>x.context==="dfl"),saldo=aa.reduce((s:number,x:any)=>s+Number(x.balance||0),0),t=day(),q=await db.from("transactions").select("amount,type,status,affects_balance").eq("user_id",u.user_id).eq("context","dfl").eq("date",t),rows=q.data||[],done=rows.filter((x:any)=>x.status==="done"&&x.affects_balance===true),entradas=done.filter((x:any)=>x.type==="income").reduce((s:number,x:any)=>s+Number(x.amount||0),0),saidas=done.filter((x:any)=>x.type==="expense"||x.type==="sangria").reduce((s:number,x:any)=>s+Number(x.amount||0),0),pend=rows.filter((x:any)=>x.status==="pending"&&x.affects_balance===false).length;const out=await reply(`🏢 *Empresa hoje*\n\n💰 Saldo das contas Empresa: *${money(saldo)}*\n🟢 Entradas realizadas hoje: *${money(entradas)}*\n🔴 Saídas realizadas hoje: *${money(saidas)}*\n📊 Resultado realizado do dia: *${money(entradas-saidas)}*\n🕒 Pendências de hoje: *${pend}*`);await done(aid,"extracted",out,{action:"query.company_today",accounts:aa.length,pending:pend});return new Response("OK")}
if(/onde gastei mais/.test(n)){const p=pendingPeriod(text),pf=pendingFilters(text);let q=db.from("transactions").select("amount,category_id,context").eq("user_id",u.user_id).in("type",["expense","sangria"]).eq("status","done").eq("affects_balance",true).gte("date",p.start).lte("date",p.end);if(pf.context)q=q.eq("context",pf.context);const qr=await q,rows=qr.data||[],ids=[...new Set(rows.map((x:any)=>x.category_id).filter(Boolean))],cq=ids.length?await db.from("categories").select("id,name").eq("user_id",u.user_id).in("id",ids):{data:[] as any[]},names=new Map((cq.data||[]).map((c:any)=>[c.id,c.name])),m=new Map<string,number>();for(const x of rows){const k=names.get(x.category_id)||"Sem categoria";m.set(k,(m.get(k)||0)+Number(x.amount||0))}const top=[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5),ctx=pf.context==="dfl"?" · Empresa":pf.context==="personal"?" · Pessoal":"";const out=await reply(top.length?`📊 *Onde você mais gastou — ${p.label}${ctx}*\n\n${top.map(([k,v],i)=>`*${i+1}.* ${k} — *${money(v)}*`).join("\n")}`:`Não encontrei despesas realizadas em *${p.label}${ctx}*.`);await done(aid,"extracted",out,{action:"query.top_categories",period:p,context:pf.context});return new Response("OK")}
const debtPayDirect=text.match(/^(.+?)\s+(?:pagou|me pagou|pagou-me)\s+(?:r\$\s*)?([\d.,]+)/i);if(debtPayDirect){const name=debtPayDirect[1].trim(),v=amount(debtPayDirect[2]);if(v){const q=await db.from("debts").select("id,person_name,total_amount,paid_amount,context,contact_id").eq("user_id",u.user_id).in("status",["pending","partial"]).ilike("person_name",name).order("due_date",{ascending:true}).limit(3),rows=q.data||[];if(rows.length===1){const aa=await accs(u.user_id,rows[0].context);await save(phone,"DEBT_PAY_ACC",{debt:rows[0],pay_amount:v,accounts:aa});const rem=Math.max(0,Number(rows[0].total_amount||0)-Number(rows[0].paid_amount||0)),credit=Math.max(0,v-rem);const o=await reply(list(aa,`💵 *${rows[0].person_name} pagou ${money(v)}*\n${credit>0?`Excedente previsto: *${money(credit)}*\n`:""}Em qual conta o dinheiro entrou?`,true));await done(aid,"extracted",o,{action:"receivable.direct_payment_start",debt_id:rows[0].id});return new Response("OK")}if(rows.length>1){const o=await reply(`Encontrei mais de uma cobrança ativa para *${name}*. Use *quem me deve?* para escolher qual recebeu esse pagamento.`);await done(aid,"extracted",o);return new Response("OK")}}}
if(/^(quem esta atrasado|quem está atrasado|cobrancas atrasadas|cobranças atrasadas)/.test(n)){const today=day(),q=await db.from("debts").select("person_name,total_amount,paid_amount,due_date").eq("user_id",u.user_id).in("status",["pending","partial"]).lt("due_date",today).order("due_date",{ascending:true}).limit(15),rows=q.data||[];const o=await reply(rows.length?`⚠️ *Valores a receber atrasados*\n\n${rows.map((d:any)=>`• *${d.person_name}* · ${money(Math.max(0,Number(d.total_amount)-Number(d.paid_amount||0)))} · venceu ${d.due_date}`).join("\n")}`:"✅ *Nenhum valor a receber está atrasado.*");await done(aid,"extracted",o,{action:"receivable.overdue",count:rows.length});return new Response("OK")}
if(/assinaturas?.*(?:semana|proximos 7 dias|próximos 7 dias)|(?:o que|oque).*vence.*semana/.test(n)){const start=day(),end=new Date(Date.now()+7*86400000).toISOString().slice(0,10),q=await db.from("subscriptions").select("name,amount,next_due_date,status").eq("user_id",u.user_id).eq("status","active").gte("next_due_date",start).lte("next_due_date",end).order("next_due_date"),rows=q.data||[];const o=await reply(rows.length?`📅 *Assinaturas nos próximos 7 dias*\n\n${rows.map((x:any)=>`• *${x.name}* · ${money(x.amount)} · ${x.next_due_date}`).join("\n")}`:"✅ *Nenhuma assinatura vence nos próximos 7 dias.*");await done(aid,"extracted",o,{action:"subscription.upcoming",count:rows.length});return new Response("OK")}
const spend=n.match(/quanto (?:gastei|gasto) (?:com|em) (.+?)(?: esse mes| este mes| no mes)?[?!.]*$/);if(spend){const wanted=spend[1].replace(/\s+(esse|este|no) mes$/,"").trim(),start=`${day().slice(0,8)}01`,cats=await db.from("categories").select("id,name").eq("user_id",u.user_id).eq("type","expense"),cat=matchNamed(cats.data||[],wanted);if(!cat){const o=await reply(`Não encontrei a categoria *${wanted}*.`);await done(aid,"extracted",o);return new Response("OK")}const q=await db.from("transactions").select("amount").eq("user_id",u.user_id).eq("category_id",cat.id).in("type",["expense","sangria"]).eq("status","done").eq("affects_balance",true).gte("date",start).lte("date",day()),total=(q.data||[]).reduce((a:number,x:any)=>a+Number(x.amount||0),0);const o=await reply(`📉 *${cat.name} — este mês*\n\n💰 Total gasto: *${money(total)}*\n🧾 ${(q.data||[]).length} movimentações`);await done(aid,"extracted",o,{action:"query.category_spend",category_id:cat.id});return new Response("OK")}
if(/^(pendencias|pendentes|ver pendencias|o que tenho pendente)/.test(n)){const period=pendingPeriod(text),pf=pendingFilters(text);let q=db.from("transactions").select("id,type,amount,description,date,account_id,context,receipt_url,category_id").eq("user_id",u.user_id).eq("status","pending").eq("affects_balance",false).in("type",["income","expense","sangria"]).gte("date",period.start).lte("date",period.end);if(pf.context)q=q.eq("context",pf.context);if(pf.type==="income")q=q.eq("type","income");if(pf.type==="expense")q=q.in("type",["expense","sangria"]);const r=await q.order("date",{ascending:true}).limit(25),items=r.data||[],filterLabel=[pf.type==="income"?"receitas":pf.type==="expense"?"despesas":"",pf.context==="dfl"?"Empresa":pf.context==="personal"?"Pessoal":""].filter(Boolean).join(" · ");if(!items.length){const o=await reply(`✅ *Nenhuma pendência em ${period.label}*${filterLabel?` · ${filterLabel}`:""}.\n\nPara outro período, tente *pendências novembro*, *pendências nov/26* ou *pendências 11/2026*.`);await done(aid,"extracted",o,{action:"transaction.list_pending",period,filters:pf,count:0});return new Response("OK")}await save(phone,"PENDING_PICK",{items,period,filters:pf});const o=await reply(`🕒 *Pendências — ${period.label}*${filterLabel?`\n_${filterLabel}_`:""}\n\n${items.map((x:any,i:number)=>`*${i+1}* — ${x.type==="income"?"🟢":"🔴"} *${money(x.amount)}* · ${x.description||"Sem descrição"} · ${x.date}${x.receipt_url?" · 📎":""}`).join("\n")}\n\nDigite o número para revisar/efetivar.\n_Outro período: “pendências novembro”, “pendências nov/26” ou “pendências 11/2026”._`);await done(aid,"extracted",o,{action:"transaction.list_pending",period,filters:pf,count:items.length});return new Response("OK")}
const subQuick=text.match(/^(?:assino|assinatura)\s+(.+?)\s+(?:por|de)\s+(?:r\$\s*)?([\d.,]+)(?:\s+(?:vence|dia)\s+(\d{1,2}))?$/i);
if(subQuick){const name=subQuick[1].trim().slice(0,80),v=amount(subQuick[2]),due=Number(subQuick[3]||0);if(!v){const o=await reply("Informe um valor válido para a assinatura.");await done(aid,"extracted",o);return new Response("OK")}if(due>=1&&due<=31){await save(phone,"SUB_CTX",{name,amount:v,due_day:due});const o=await reply(`🔁 *${name}* · ${money(v)} · dia *${due}*\n\n🏦 Qual o contexto?\n*1* — 🏢 Empresa\n*2* — 👤 Pessoal`);await done(aid,"extracted",o,{action:"subscription.quick_start"});return new Response("OK")}await save(phone,"SUB_DAY",{name,amount:v});const o=await reply(`🔁 *${name}* · ${money(v)}\n\n📅 Qual o dia do vencimento?`);await done(aid,"extracted",o,{action:"subscription.quick_start"});return new Response("OK")}
if(/^(criar |nova |cadastrar )?(assinatura|subscription)\b/.test(n)){await save(phone,"SUB_NAME",{});const o=await reply("🔁 *Nova assinatura*\n\nQual é o nome?\nEx.: Netflix, Google One, Adobe");await done(aid,"extracted",o,{action:"subscription.start"});return new Response("OK")}
const debtDirectPay=text.match(/^(.+?)\s+(?:me\s+pagou|pagou|quitou)\s+(?:r\$\s*)?([\d.,]+)$/i);
if(debtDirectPay){const name=debtDirectPay[1].trim(),v=amount(debtDirectPay[2]);if(!v){const o=await reply("Informe um valor válido.");await done(aid,"extracted",o);return new Response("OK")}const q=await db.from("debts").select("*").eq("user_id",u.user_id).in("status",["pending","partial"]).ilike("person_name",name).limit(2);if((q.data||[]).length!==1){const o=await reply((q.data||[]).length?"Encontrei mais de uma cobrança com esse nome. Use *quem me deve?* e escolha a correta.":"Não encontrei uma cobrança ativa com esse nome.");await done(aid,"extracted",o);return new Response("OK")}const d=q.data![0],aa=await accs(u.user_id,d.context);await save(phone,"DEBT_PAY_ACC",{debt:d,pay_amount:v,accounts:aa});const rem=Math.max(0,Number(d.total_amount||0)-Number(d.paid_amount||0)),credit=Math.max(0,v-rem);const o=await reply(list(aa,`💵 *${d.person_name} pagou ${money(v)}*\nEm qual conta entrou?`,true)+(credit>0?`\n💳 Excedente previsto: *${money(credit)}*`:""));await done(aid,"extracted",o,{action:"receivable.payment_direct",debt_id:d.id,amount:v});return new Response("OK")}
const debtDirectDue=text.match(/^(.+?)\s+(?:vence|vencimento)\s+(?:dia\s+)?(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)$/i);
if(debtDirectDue){const name=debtDirectDue[1].trim(),m=debtDirectDue[2].match(/(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/);const yy=m?.[3]?Number(m[3].length===2?"20"+m[3]:m[3]):Number(day().slice(0,4)),mm=Number(m?.[2]||0),dd=Number(m?.[1]||0),x=new Date(Date.UTC(yy,mm-1,dd,12));if(!m||x.getUTCFullYear()!==yy||x.getUTCMonth()!==mm-1||x.getUTCDate()!==dd){const o=await reply("Essa data não é válida.");await done(aid,"extracted",o);return new Response("OK")}const q=await db.from("debts").select("*").eq("user_id",u.user_id).in("status",["pending","partial"]).ilike("person_name",name).limit(2);if((q.data||[]).length!==1){const o=await reply((q.data||[]).length?"Encontrei mais de uma cobrança com esse nome. Use *quem me deve?* e escolha a correta.":"Não encontrei uma cobrança ativa com esse nome.");await done(aid,"extracted",o);return new Response("OK")}const due=`${yy}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`,d=q.data![0],up=await db.from("debts").update({due_date:due,updated_at:new Date().toISOString(),sync_status:"synced"}).eq("id",d.id).eq("user_id",u.user_id);if(up.error)throw up.error;const o=await reply(`✅ Vencimento de *${d.person_name}* alterado para *${due}*.`);await done(aid,"extracted",o,{action:"receivable.update_due_direct",debt_id:d.id,due_date:due});return new Response("OK")}
const owe=n.match(/^(.+?)\s+me\s+deve\s+(?:r\$\s*)?([\d.,]+)/);if(owe){const v=amount(owe[2]),person=text.slice(0,text.toLowerCase().indexOf(" me deve")).trim(),md=text.match(/\b(0?[1-9]|[12]\d|3[01])[\/-](0?[1-9]|1[0-2])(?:[\/-](\d{2}|\d{4}))?\b/);let due:string|null=null;if(md){const yy=md[3]?Number(md[3].length===2?"20"+md[3]:md[3]):Number(day().slice(0,4)),mm=Number(md[2]),dd=Number(md[1]),x=new Date(Date.UTC(yy,mm-1,dd,12));if(x.getUTCFullYear()===yy&&x.getUTCMonth()===mm-1&&x.getUTCDate()===dd)due=`${yy}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`}if(due){await save(phone,"DEBT_CTX",{person_name:person,total_amount:v,due_date:due});const o=await reply(`👤 *${person}* te deve *${money(v)}*\n📅 Vencimento: *${md?.[1]}/${md?.[2]}/${due.slice(0,4)}*\n\n🏦 Contexto:\n*1* — 🏢 Empresa\n*2* — 👤 Pessoal`);await done(aid,"extracted",o,{action:"receivable.start",due_date:due});return new Response("OK")}await save(phone,"DEBT_DUE",{person_name:person,total_amount:v});const o=await reply(`👤 Entendi: *${person}* te deve *${money(v)}*.\n\n📅 Qual o vencimento?\nEx.: *15/10/2026* ou *sem data*`);await done(aid,"extracted",o,{action:"receivable.start"});return new Response("OK")}
if(/^(criar |novo |cadastrar )?(quem me deve|valor a receber|recebivel)/.test(n)){await save(phone,"DEBT_NAME",{});const o=await reply("👤 *Novo valor a receber*\n\nQual é o nome da pessoa?");await done(aid,"extracted",o,{action:"receivable.start"});return new Response("OK")}
const catQuick=text.match(/^(?:criar|nova|cadastrar)?\s*categoria\s+(.+?)\s+(despesa|receita)$/i);
if(catQuick){const nm=catQuick[1].trim().slice(0,80),type=N(catQuick[2])==="receita"?"income":"expense";await save(phone,"CAT_CTX",{name:nm,type});const o=await reply(`🏷️ Categoria *${nm}* · *${type==="income"?"Receita":"Despesa"}*\n\nContexto:\n*1* — 🏢 Empresa\n*2* — 👤 Pessoal`);await done(aid,"extracted",o,{action:"category.quick_start"});return new Response("OK")}
if(/^(criar |nova |cadastrar )?categoria\b/.test(n)){const nm=text.replace(/^(criar|nova|cadastrar)?\s*categoria\s*/i,"").trim();if(nm){await save(phone,"CAT_TYPE",{name:nm});const o=await reply(`🏷️ Nova categoria: *${nm}*\n\n*1* — 🔴 Despesa\n*2* — 🟢 Receita`);await done(aid,"extracted",o,{action:"category.start"});return new Response("OK")}await save(phone,"CAT_NAME",{});const o=await reply("🏷️ *Nova categoria*\n\nQual é o nome?");await done(aid,"extracted",o,{action:"category.start"});return new Response("OK")}
if(transfer(text)){const v=amount(text);if(!v){const o=await reply("💸 Entendi a transferência, mas faltou o valor.");await done(aid,"extracted",o);return new Response("OK")}const temp={kind:"transfer",amount:v,description:text,date:naturalDate(text),provider_message_id:k,audit_message_id:aid},aa=await allAccs(u.user_id),pair=N(text).match(/(?:da|do|de)\s+(.+?)\s+para\s+(.+?)(?=\s+(?:hoje|ontem|anteontem|amanha)\b|$)/),from=pair?matchNamed(aa,pair[1]):null,to=pair?matchNamed(aa,pair[2]):null;if(from&&to&&from.id!==to.id){const fromAfter=Number(from.balance||0)-v,toAfter=Number(to.balance||0)+v;await save(phone,"TR_CONFIRM",{...temp,from,to,fromAfter,toAfter});const warning=fromAfter<0?"\n⚠️ *A origem ficará negativa.*":"";const o=await reply(`🔄 *Confirmar transferência*\n\n*${from.name}* → *${to.name}*\nValor: *${money(v)}*\n\nOrigem: ${money(from.balance)} → *${money(fromAfter)}*\nDestino: ${money(to.balance)} → *${money(toAfter)}*${warning}\n\n*1* — Confirmar\n*2* — Cancelar`);await done(aid,"extracted",o,temp);return new Response("OK")}await save(phone,"TR_CTX",temp);const o=await reply(`💸 *Transferência de ${money(v)}*\n\nNão consegui identificar as duas contas com segurança.\n\nQual o contexto?\n*1* - 🏢 Empresa\n*2* - 👤 Pessoal`);await done(aid,"extracted",o,temp);return new Response("OK")}
const si=subInfo(text),v=amount(text),ec=explicitCategory(text);if(si&&v){const o=await reply("🔁 Entendi que é uma assinatura. Você pode dizer, por exemplo: *assinatura Netflix por 44,90 dia 10* — ou mandar *criar assinatura*.");await done(aid,"extracted",o,{kind:"subscription",action:"subscription.clarify"});return new Response("OK")}
const ty=typeOf(text);if(ty&&!v){await save(phone,"TX_AMOUNT",{kind:"transaction_start",type:ty,provider_message_id:k,audit_message_id:aid});const o=await reply(voiceAmount(ty,k));await done(aid,"extracted",o,{action:"clarify.amount",type:ty});return new Response("OK")}if(!ty){const o=await reply("🤔 Não consegui identificar com segurança o que você quer fazer.\n\nTente escrever naturalmente o lançamento ou digite *ajuda* para ver tudo que eu consigo fazer.");await done(aid,"extracted",o,{action:"fallback.help"});return new Response("OK")}
const rc=recur(text),ih=hint(text,ty),knownAccounts=await allAccs(u.user_id),accountHit=accountsInText(knownAccounts,text),matchedAccount=accountHit.account,ctx=explicitContext(text)||matchedAccount?.context||null,ea=matchedAccount?.name||explicitAccount(text);let desc=cleanDescription(text,ty,ea,ctx,ec).slice(0,120);if(matchedAccount)desc=stripMatchedAccount(desc,matchedAccount).slice(0,120);const semanticCat=ec;if(semanticCat){const dp=desc.split(/\s+/),cn=N(semanticCat);if(dp.length>1&&N(dp[0])===cn)desc=dp.slice(1).join(" ");else if(dp.length>1&&N(dp[dp.length-1])===cn)desc=dp.slice(0,-1).join(" ")}if(!desc.trim())desc=ty==="income"?"Receita":"Despesa";const temp={kind:"transaction",type:ty,amount:v,description:desc,category_explicit:ec,category_hint:ih,account_explicit:ea,account:matchedAccount,account_ambiguous:accountHit.ambiguous===true,account_matches:accountHit.ambiguous?accountHit.matches:undefined,context:ctx,date:explicitDate(text)||naturalDate(text),provider_message_id:k,audit_message_id:aid,recurrence:rc};await save(phone,"TX_CONFIRM",temp);const lines=[voiceConfirm(k),``,`${ty==="income"?"🟢 Receita":"🔴 Despesa"} de *${money(v)}*`,`📝 ${temp.description}`,ec?`🏷️ Categoria informada: *${ec}*`:ih?`🏷️ Sugestão: *${ih}*`:"🏷️ Categoria: vou confirmar depois",matchedAccount?`🏦 *${matchedAccount.name}*`:ea?`🏦 Conta informada: *${ea}*`:"🏦 Conta: vou confirmar se necessário",matchedAccount?`${matchedAccount.context==="dfl"?"🏢 Empresa":"👤 Pessoal"} · identificado pela conta`:ctx?`${ctx==="dfl"?"🏢 Empresa":"👤 Pessoal"}`:"🏢 Contexto: vou perguntar se necessário",rc?`🔁 Recorrência ${rc.label}`:"",`📅 ${temp.date}`,``,voiceConfirmQuestion(k),`*1* - ✅ Confirmar`,`*2* - ✏️ Corrigir`].filter(Boolean).join("\n");const o=await reply(lines);await done(aid,"extracted",o,temp);return new Response("OK")
}catch(e){console.error("[DFL_FINANCE_V153_WEBHOOK_ERROR]",e);return new Response("OK")}});
