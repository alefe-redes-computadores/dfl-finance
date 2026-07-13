// Adicione o Link no topo do arquivo
import Link from 'next/link';
import { useIsAdmin } from '@/hooks/useAdmin'; // Importe o hook

export function SyncStatusModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { pendingCount, isSyncing, forceSync } = useLocalSync();
  const { isAdmin } = useIsAdmin(); // Verifique se é admin

  if (!isOpen) return null;

  return (
    // ... (resto do seu código)
    
        {/* Adicione isso logo antes do final do modal (antes da tag de fechamento) */}
        {isAdmin && (
          <Link 
            href="/admin/sync" 
            className="block text-center text-xs text-purple-500 hover:text-purple-600 mt-4 underline font-medium"
            onClick={onClose}
          >
            Acessar Painel de Admin
          </Link>
        )}
      </div>
    </div>
  );
}
