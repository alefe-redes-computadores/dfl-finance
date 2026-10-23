'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ minHeight: '100dvh', boxSizing: 'border-box', display: 'grid', placeItems: 'center', padding: 'max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom))' }}>
          <section role="alert" style={{ width: '100%', maxWidth: 420, overflowWrap: 'anywhere' }}>
            <h1 style={{ fontSize: 24 }}>Não foi possível abrir o Finance</h1>
            <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>Tente novamente. Esta ação não apaga seus dados locais nem sua fila de sincronização.</p>
            <button type="button" onClick={reset} style={{ minHeight: 48, width: '100%', border: 0, borderRadius: 16, background: '#0d9488', color: '#fff', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Tentar novamente</button>
            {process.env.NODE_ENV === 'development' && (
              <pre style={{ whiteSpace: 'pre-wrap' }}>{error.message}{'\n'}{error.stack}</pre>
            )}
          </section>
        </main>
      </body>
    </html>
  )
}
