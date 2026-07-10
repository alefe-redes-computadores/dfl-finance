// src/app/layout.tsx (Versão de teste)

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-white">
        {/* Desativamos temporariamente os providers para testar */}
        {children}
      </body>
    </html>
  )
}
