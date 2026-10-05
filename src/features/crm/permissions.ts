import { useAuth } from '../../contexts/AuthContext';

/** Mirrors the server permission matrix (src/server/core.ts); the server remains the authority. */
export function usePermissions() {
  const { userData } = useAuth();
  const list = ((userData as any)?.permissions ?? []) as string[];
  return {
    can: (p: string) => list.includes(p),
    isDemo: Boolean((userData as any)?.isDemo),
    role: userData?.role,
    userId: (userData as any)?.id as string | undefined,
  };
}

export const CRM_ROLES = ['admin', 'property_manager', 'sales', 'landlord'];
