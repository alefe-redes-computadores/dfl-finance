'use client'

import { Component, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary capturou:', error, errorInfo)
    // Aqui você pode enviar para um serviço de logging (ex: Sentry)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
          <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
            <AlertCircle size={40} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            Algo deu errado
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-6 py-3 bg-teal-700 text-white rounded-full font-bold hover:bg-teal-800 transition-colors"
          >
            <RefreshCw size={18} />
            Recarregar
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mt-6 p-4 bg-gray-100 dark:bg-slate-800 rounded-xl text-left w-full max-w-md overflow-auto">
              <p className="text-xs font-mono text-red-600 dark:text-red-400">
                {this.state.error.message}
              </p>
              <p className="text-xs font-mono text-gray-500 mt-2">
                {this.state.error.stack}
              </p>
            </div>
          )}
        </div>
      )
    }

    return this.props.children
  }
}