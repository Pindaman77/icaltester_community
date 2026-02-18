import { useAuth } from '@/hooks/useAuth';
import { AppRole } from './types';

type UseRoleResult = {
  role: AppRole | null;
  isLoading: boolean;
  error: Error | null;
};

export function useRole(): UseRoleResult {
  const { role, roleLoading } = useAuth();
  return {
    role,
    isLoading: roleLoading,
    error: null,
  };
}

