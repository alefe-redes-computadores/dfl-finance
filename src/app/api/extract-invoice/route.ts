import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Se pdf-parse não estiver instalado, execute: npm install pdf-parse
// ou remova a funcionalidade de PDF e use apenas OFX.
// Deixei um try/catch dinâmico para importar apenas se necessário.
const { XMLParser } = require('fast-xml-parser');

interface ExtractedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
}

interface ReviewSuggestion {
  imported: ExtractedTransaction;
  matched: {
    id: string;
    description: string;
    amount: number;
    date: string;
    similarity: number;
  };
  score: number;
}

function similarity(a: string, b: string): number {
  const aLower = a.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const bLower = b.toLowerCase().replace(/[^a-z0-9 ]/g, '');

  if (aLower === bLower) return 1.0;

  const maxLen = Math.max(aLower.length, bLower.length);
  if (maxLen === 0) return 1.0;

  const dp: number[][] = Array(aLower.length + 1)
    .fill(null)
    .map(() => Array(bLower.length + 1).fill(0));

  for (let i = 0; i <= aLower.length; i++) dp[i][0] = i;
  for (let j = 0; j <= bLower.length; j++) dp[0][j] = j;

  for (let i = 1; i <= aLower.length; i++) {
    for (let j = 1; j <= bLower.length; j++) {
      dp[i][j] =
        aLower[i - 1] === bLower[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  const distance = dp[aLower.length][bLower.length];
  return 1 - distance / maxLen;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const sourceType = (formData.get('sourceType') as string) || 'bank_statement';

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  let transactions: ExtractedTransaction[] = [];

  try {
    if (file.name.endsWith('.pdf')) {
      // Tenta importar pdf-parse dinamicamente (se instalado)
      let pdfParse: any;
      try {
        pdfParse = require('pdf-parse');
      } catch {
        return NextResponse.json({ error: 'pdf-parse não instalado. Execute npm install pdf-parse' }, { status: 500 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const pdfData = await pdfParse.default ? pdfParse.default(buffer) : pdfParse(buffer);
      const text = pdfData.text;

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `Extraia transações financeiras... (seu prompt aqui) Texto: ${text.substring(0, 30000)}`;
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        transactions = JSON.parse(jsonMatch[0]);
      }
    } else if (file.name.endsWith('.ofx')) {
      const text = await file.text();
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(text);

      const stmts =
        parsed?.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKTRANLIST?.STMTTRN ||
        parsed?.OFX?.CREDITCARDMSGSRSV1?.CCSTMTTRNRS?.CCSTMTRS?.BANKTRANLIST?.STMTTRN ||
        [];

      transactions = (Array.isArray(stmts) ? stmts : [stmts]).map((t: any) => ({
        date: t.DTPOSTED?.substring(0, 10) || t.DTTRNAVAIL?.substring(0, 10) || '',
        description: t.MEMO || t.NAME || '',
        amount: Math.abs(parseFloat(t.TRNAMT || '0')),
        type: parseFloat(t.TRNAMT || '0') > 0 ? 'income' : 'expense',
      }));
    } else {
      return NextResponse.json({ error: 'Formato não suportado' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: 'Falha na extração', details: error.message }, { status: 500 });
  }

  // Conciliação
  const { data: existingTransactions } = await supabase
    .from('transactions')
    .select('id, amount, date, description')
    .eq('user_id', user.id)
    .eq('context', 'pf');

  const newTrans: ExtractedTransaction[] = [];
  const review: ReviewSuggestion[] = [];
  const duplicates: ExtractedTransaction[] = [];

  for (const imported of transactions) {
    let bestMatch: any = null;
    let bestScore = 0;

    if (existingTransactions) {
      for (const existing of existingTransactions) {
        if (Math.abs(existing.amount - imported.amount) > 0.01) continue;

        const importedDate = new Date(imported.date);
        const existingDate = new Date(existing.date);
        const diffDays = Math.abs(importedDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 2) continue;

        const textSimilarity = similarity(imported.description, existing.description);
        const totalScore = 0.5 + Math.max(0, 1 - diffDays / 2) * 0.3 + textSimilarity * 0.2;

        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestMatch = existing;
        }
      }
    }

    if (bestMatch && bestScore >= 0.95) {
      duplicates.push(imported);
    } else if (bestMatch && bestScore >= 0.8) {
      review.push({
        imported,
        matched: {
          id: bestMatch.id,
          description: bestMatch.description,
          amount: bestMatch.amount,
          date: bestMatch.date,
          similarity: bestScore,
        },
        score: bestScore,
      });
    } else {
      newTrans.push(imported);
    }
  }

  return NextResponse.json({ new: newTrans, review, duplicates });
}