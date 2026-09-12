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
        <div className="app-page flex min-h-[70dvh] items-center justify-center px-4 py-10 text-center">
          <div className="app-surface w-full max-w-md px-6 py-8">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[22px] bg-red-50 dark:bg-red-950/30">
            <AlertCircle size={40} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            Algo deu errado
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="app-primary-action mx-auto flex items-center justify-center gap-2 px-6"
          >
            <RefreshCw size={18} />
            Recarregar
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mt-6 w-full overflow-auto rounded-2xl bg-gray-100 p-4 text-left dark:bg-slate-950/60">
              <p className="text-xs font-mono text-red-600 dark:text-red-400">
                {this.state.error.message}
              </p>
              <p className="text-xs font-mono text-gray-500 mt-2">
                {this.state.error.stack}
              </p>
            </div>
          )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}