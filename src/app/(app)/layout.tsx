export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Comente o ContextProvider
  return (
    <>
      <AppContent>{children}</AppContent>
    </>
  )
}
