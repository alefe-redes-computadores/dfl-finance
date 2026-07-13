// src/hooks/useAdmin.ts
import { useAuth } from '@/lib/hooks/useAuth'

export function useIsAdmin() {
  const { user } = useAuth()
  const ADMIN_ID = '64c7cfd8-218a-4366-aba1-2150b95a37ba' 
  
  return user?.id === ADMIN_ID
}
