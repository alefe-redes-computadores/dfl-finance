// src/hooks/useAdmin.ts
import { useAuth } from '@/lib/hooks/useAuth'

export function useIsAdmin() {
  const { user } = useAuth()
  
  // Substitua pelo seu ID real do Supabase
  const ADMIN_ID = 'SEU_ID_DO_SUPABASE_AQUI' 
  
  return user?.id === ADMIN_ID
}
