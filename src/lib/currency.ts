import type { BudgetCurrency } from './types'

const CURRENCY_LOCALE: Record<BudgetCurrency, { locale: string; currency: string }> = {
  EUR: { locale: 'es-ES', currency: 'EUR' },
  USD: { locale: 'en-US', currency: 'USD' },
  ARS: { locale: 'es-AR', currency: 'ARS' },
}

export function formatAmount(amount: number, currency: BudgetCurrency): string {
  const { locale, currency: currencyCode } = CURRENCY_LOCALE[currency]
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  }).format(amount)
}
