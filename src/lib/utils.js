// src/lib/utils.js
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combina classes CSS com suporte a condicionais e merge de Tailwind
 * @param  {...any} inputs - Classes condicionais ou strings
 * @returns {string} Classes CSS combinadas
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Formata um valor numérico para moeda brasileira (R$)
 * @param {number} val - Valor a ser formatado
 * @returns {string} Valor formatado (ex: R$ 1.234,56)
 */
export function formatCurrency(val) {
  return `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}