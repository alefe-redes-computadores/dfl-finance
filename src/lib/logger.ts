type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export const logger = {
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data)
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data)
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error)
    // Opcional: enviar para serviço de logging (ex: Sentry) posteriormente
  },
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, data)
    }
  },
}

// Função para capturar erros de Supabase
export const handleSupabaseError = (error: any, fallbackMessage?: string) => {
  const message = error?.message || fallbackMessage || 'Erro ao comunicar com o servidor.'
  logger.error(message, error)
  return message
}