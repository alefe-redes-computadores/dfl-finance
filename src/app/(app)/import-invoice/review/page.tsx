'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, GitMerge, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/utils/supabase/client';

interface ExtractedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
}


interface ReviewItem {
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

export default function ReviewImportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const supabase = createClient();

  const [newTrans] = useState<ExtractedTransaction[]>(() => {
    const data = searchParams.get('new');
    return data ? JSON.parse(atob(data)) : [];
  });
  const [review] = useState<ReviewItem[]>(() => {
    const data = searchParams.get('review');
    return data ? JSON.parse(atob(data)) : [];
  });
  const [duplicates] = useState<ExtractedTransaction[]>(() => {
    const data = searchParams.get('duplicates');
    return data ? JSON.parse(atob(data)) : [];
  });

  const [selectedNew, setSelectedNew] = useState<boolean[]>(newTrans.map(() => true));
  const [reviewDecisions, setReviewDecisions] = useState<('merge' | 'keep' | null)[]>(review.map(() => null));

  const handleConfirm = async () => {
    const confirmedNew = newTrans.filter((_, i) => selectedNew[i]);
    const mergedIds: string[] = [];
    const keepTransactions: ExtractedTransaction[] = [];

    review.forEach((item, i) => {
      if (reviewDecisions[i] === 'merge') {
        mergedIds.push(item.matched.id);
      } else if (reviewDecisions[i] === 'keep') {
        keepTransactions.push(item.imported);
      }
    });

    // Obtém o usuário UMA VEZ, antes do map
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: 'Erro', description: 'Não autenticado.', variant: 'destructive' });
      return;
    }

    const toInsert = [...confirmedNew, ...keepTransactions];

    try {
      if (toInsert.length > 0) {
        const insertData = toInsert.map((t) => ({
          user_id: user.id,
          amount: t.amount,
          description: t.description,
          date: t.date,
          type: t.type,
          context: 'pf', // ajustar conforme necessário
          source: 'ofx_import',
          affects_balance: true,
        }));

        const { error } = await supabase.from('transactions').insert(insertData);
        if (error) throw error;
      }

      if (mergedIds.length > 0) {
        const { error } = await supabase
          .from('transactions')
          .update({ source: 'ofx_merged' })
          .in('id', mergedIds);
        if (error) throw error;
      }

      toast({
        title: 'Importação concluída',
        description: `${confirmedNew.length + keepTransactions.length} adicionadas, ${mergedIds.length} mescladas, ${duplicates.length} ignoradas.`,
      });
      router.push('/home');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-semibold">Revisar Importação</h1>
      </div>

      {/* Novas */}
      <Card className="border-l-4 border-l-emerald-500">
        <CardContent className="p-4">
          <h2 className="text-lg font-medium text-emerald-600 flex items-center gap-2">
            <Check className="w-5 h-5" /> Novas ({newTrans.length})
          </h2>
          {newTrans.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">Nenhuma transação nova detectada.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {newTrans.map((t, i) => (
                <label key={i} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedNew[i]}
                    onChange={(e) => {
                      const updated = [...selectedNew];
                      updated[i] = e.target.checked;
                      setSelectedNew(updated);
                    }}
                    className="rounded"
                  />
                  <span className="flex-1">
                    {t.description} - {formatCurrency(t.amount)} <span className="text-muted-foreground">({t.date})</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revisão */}
      <Card className="border-l-4 border-l-amber-500">
        <CardContent className="p-4">
          <h2 className="text-lg font-medium text-amber-600 flex items-center gap-2">
            <GitMerge className="w-5 h-5" /> Para Revisão ({review.length})
          </h2>
          {review.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">Nenhuma correspondência parcial.</p>
          ) : (
            <div className="mt-2 space-y-4">
              {review.map((item, i) => (
                <div key={i} className="border rounded-lg p-3 text-sm">
                  <div className="flex justify-between mb-2">
                    <div>
                      <p className="font-medium">Importada: {item.imported.description}</p>
                      <p className="text-muted-foreground">{formatCurrency(item.imported.amount)} • {item.imported.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">Existente: {item.matched.description}</p>
                      <p className="text-muted-foreground">{formatCurrency(item.matched.amount)} • {item.matched.date}</p>
                      <p className="text-xs text-muted-foreground">Similaridade: {(item.score * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={reviewDecisions[i] === 'merge' ? 'default' : 'outline'}
                      onClick={() => {
                        const updated = [...reviewDecisions];
                        updated[i] = 'merge';
                        setReviewDecisions(updated);
                      }}
                    >
                      <GitMerge className="w-4 h-4 mr-1" /> Mesclar
                    </Button>
                    <Button
                      size="sm"
                      variant={reviewDecisions[i] === 'keep' ? 'default' : 'outline'}
                      onClick={() => {
                        const updated = [...reviewDecisions];
                        updated[i] = 'keep';
                        setReviewDecisions(updated);
                      }}
                    >
                      <X className="w-4 h-4 mr-1" /> Manter Separadas
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Duplicatas */}
      <Card className="border-l-4 border-l-red-500">
        <CardContent className="p-4">
          <h2 className="text-lg font-medium text-red-600 flex items-center gap-2">
            <X className="w-5 h-5" /> Duplicatas Ignoradas ({duplicates.length})
          </h2>
          {duplicates.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">Nenhuma duplicata exata.</p>
          ) : (
            <div className="mt-2 space-y-1">
              {duplicates.map((t, i) => (
                <p key={i} className="text-sm text-muted-foreground">
                  {t.description} - {formatCurrency(t.amount)} ({t.date})
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleConfirm} className="w-full py-3 text-base">
        Confirmar Importação
      </Button>
    </div>
  );
}