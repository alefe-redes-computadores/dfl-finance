'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body style={{ padding: 20, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>
        <h2>Erro capturado:</h2>
        <p>{error.message}</p>
        <p>{error.stack}</p>
        <button onClick={() => reset()}>Tentar de novo</button>
      </body>
    </html>
  )
}
