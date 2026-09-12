import Skeleton from '@/components/Skeleton'

export default function AppLoading() {
  return (
    <main className="app-page px-4 py-5" aria-busy="true" aria-live="polite">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="app-surface space-y-3 p-4">
          <Skeleton width="42%" height="24px" borderRadius="10px" />
          <Skeleton width="68%" height="14px" borderRadius="8px" />
        </div>
        <Skeleton variant="card" height="132px" borderRadius="24px" />
        <Skeleton variant="card" height="96px" borderRadius="24px" />
        <Skeleton variant="card" height="96px" borderRadius="24px" />
      </div>
      <span className="sr-only">Carregando conteúdo</span>
    </main>
  )
}
