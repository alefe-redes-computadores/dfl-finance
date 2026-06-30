// Testa a lógica de similaridade e match da conciliação
// Importa a função similarity (reproduzida aqui para teste puro)

function similarity(a, b) {
  const aLower = a.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const bLower = b.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  if (aLower === bLower) return 1.0;

  const maxLen = Math.max(aLower.length, bLower.length);
  if (maxLen === 0) return 1.0;

  const dp = Array(aLower.length + 1)
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

  return 1 - dp[aLower.length][bLower.length] / maxLen;
}

function classifyTransaction(imported, existingTransactions) {
  let bestMatch = null;
  let bestScore = 0;

  for (const existing of existingTransactions) {
    if (Math.abs(existing.amount - imported.amount) > 0.01) continue;

    const importedDate = new Date(imported.date);
    const existingDate = new Date(existing.date);
    const diffDays = Math.abs(importedDate - existingDate) / (1000 * 60 * 60 * 24);
    if (diffDays > 2) continue;

    const textSim = similarity(imported.description, existing.description);
    const dateScore = Math.max(0, 1 - diffDays / 2) * 0.3;
    const textScore = textSim * 0.2;
    const totalScore = 0.5 + dateScore + textScore;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestMatch = existing;
    }
  }

  if (bestMatch && bestScore >= 0.95) return { status: 'duplicate' };
  if (bestMatch && bestScore >= 0.8) return { status: 'review', match: bestMatch, score: bestScore };
  return { status: 'new' };
}

describe('Reconciliation Logic', () => {
  const existingTransactions = [
    { id: '1', amount: 150.0, date: '2026-06-25', description: 'Uber Viagem Centro' },
    { id: '2', amount: 89.9, date: '2026-06-26', description: 'Amazon Prime' },
    { id: '3', amount: 45.0, date: '2026-06-20', description: 'Padaria Pão Quente' },
  ];

  test('Match exato: mesmo valor, mesma data, mesma descrição -> duplicata', () => {
    const imported = { amount: 150.0, date: '2026-06-25', description: 'Uber Viagem Centro' };
    expect(classifyTransaction(imported, existingTransactions).status).toBe('duplicate');
  });

  test('Match aproximado: mesmo valor, data 1 dia depois, descrição similar -> revisão', () => {
    const imported = { amount: 89.9, date: '2026-06-27', description: 'Amazon Prime BR' };
    const result = classifyTransaction(imported, existingTransactions);
    expect(result.status).toBe('review');
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });

  test('Sem match: valor diferente -> nova', () => {
    const imported = { amount: 200.0, date: '2026-06-25', description: 'Restaurante' };
    expect(classifyTransaction(imported, existingTransactions).status).toBe('new');
  });

  test('Similaridade 1.0 para strings idênticas', () => {
    expect(similarity('Uber', 'Uber')).toBe(1.0);
  });

  test('Similaridade 0 para strings completamente diferentes', () => {
    expect(similarity('abc', 'xyz')).toBe(0);
  });
});