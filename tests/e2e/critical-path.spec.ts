import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_USER_EMAIL!;
const PASSWORD = process.env.E2E_USER_PASSWORD!;

test.describe('Fluxo Crítico - Caminho Feliz', () => {
  test('Login → Criar Transação → Verificar Saldo na Home', async ({ page }) => {
    // 1. LOGIN
    await page.goto('/login');
    
    // Aguarda campos de email/senha renderizarem
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');

    // Aguarda redirecionamento para Home
    await page.waitForURL(/\/home/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/home/);

    // Aguarda carregamento dos dados (skeleton loader desaparecer)
    await page.waitForSelector('.skeleton', { state: 'detached', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Captura saldo antes da transação
    // ATENÇÃO: Ajuste o seletor abaixo conforme o elemento que exibe o valor do saldo na Home.
    // Exemplo comum: um <span> ou <p> com font-normal e texto monetário.
    const saldoLocator = page.locator('text=Saldo Total').locator('..').locator('span.font-normal, p.font-normal, span.text-2xl, p.text-2xl').first();
    await saldoLocator.waitFor({ state: 'visible', timeout: 10000 });
    const saldoAntesTexto = await saldoLocator.textContent();

    // 2. NAVEGAR PARA NOVA TRANSAÇÃO
    // Ajuste o seletor conforme o link/botão usado para nova transação
    await page.click('a[href="/transactions/new"], button:has-text("Nova Transação"), a:has-text("Nova Transação")');
    await page.waitForURL(/\/transactions\/new/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/transactions\/new/);

    // 3. PREENCHER FORMULÁRIO
    // Valor - ajuste o name ou placeholder real do campo
    await page.fill('input[name="amount"], input[placeholder*="Valor"]', '150');

    // Descrição
    await page.fill('input[name="description"], input[placeholder*="Descrição"]', 'Teste E2E Automatizado');

    // Tipo (Despesa) - ajuste conforme o toggle ou radio do seu componente
    const btnDespesa = page.locator('button:has-text("Despesa"), label:has-text("Despesa")');
    if (await btnDespesa.isVisible()) {
      await btnDespesa.click();
    }

    // Categoria - tenta selecionar o primeiro item disponível
    // Ajuste conforme seu componente (pode ser um <select> ou um combobox customizado)
    const categoriaTrigger = page.locator('select[name="category_id"], button[role="combobox"][aria-label*="Categoria"]');
    if (await categoriaTrigger.isVisible()) {
      await categoriaTrigger.click();
      await page.waitForTimeout(500);
      const primeiraOpcao = page.locator('li[role="option"], div[role="option"], option').first();
      if (await primeiraOpcao.isVisible()) {
        await primeiraOpcao.click();
      }
    }

    // Submeter
    await page.click('button[type="submit"]');

    // Aguarda redirecionamento de volta para Home
    await page.waitForURL(/\/home/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/home/);

    // Aguarda carregamento pós-transação
    await page.waitForSelector('.skeleton', { state: 'detached', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 4. VERIFICAR SE SALDO MUDOU (deve diminuir, pois é despesa)
    const saldoDepoisLocator = page.locator('text=Saldo Total').locator('..').locator('span.font-normal, p.font-normal, span.text-2xl, p.text-2xl').first();
    await saldoDepoisLocator.waitFor({ state: 'visible', timeout: 10000 });
    const saldoDepoisTexto = await saldoDepoisLocator.textContent();

    // Função para extrair número de string monetária ("R$ 1.234,56" -> 1234.56)
    const extrairNumero = (str: string | null): number => {
      if (!str) return 0;
      const limpo = str.replace(/[^0-9,\-]/g, '').replace(',', '.');
      return parseFloat(limpo);
    };

    const saldoAntes = extrairNumero(saldoAntesTexto);
    const saldoDepois = extrairNumero(saldoDepoisTexto);

    console.log('Saldo antes:', saldoAntesTexto, '->', saldoAntes);
    console.log('Saldo depois:', saldoDepoisTexto, '->', saldoDepois);

    expect(saldoDepois).toBeLessThan(saldoAntes);
  });
});