import { format } from 'date-fns'

// Garante que o valor sempre será um número válido (evita NaN)
export const safeNumber = (val: any): number => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val).replace(',', '.').replace(/[^0-9.-]+/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

// Garante que o valor sempre será um objeto Date válido
export const safeDate = (val: any): Date => {
  if (!val) return new Date();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

// Formata a data com segurança, sem quebrar a tela se a data for nula
export const safeFormatDate = (val: any, formatStr: string = 'dd/MM/yyyy'): string => {
  try {
    return format(safeDate(val), formatStr);
  } catch (e) {
    return '';
  }
}

// Garante que o retorno seja sempre um Array (evita o erro .map is not a function)
export const safeArray = (val: any): any[] => {
  return Array.isArray(val) ? val : [];
}

// CORREÇÃO: Adicionado o terceiro parâmetro "id" opcional para a navegação funcionar na Home
export const safeNavigate = (router: any, basePath: string, id?: string) => {
  if (router && typeof router.push === 'function') {
    // Se um ID foi enviado, monta a URL certa com o parâmetro. Se não, vai só para a listagem.
    const finalPath = id ? `${basePath}?id=${encodeURIComponent(id)}` : basePath;
    router.push(finalPath);
  }
}
