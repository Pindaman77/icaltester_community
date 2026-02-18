import { useQuery } from '@tanstack/react-query';
import { SyncLog } from '@/integrations/supabase/client';
import { fnGet } from '@/lib/functionsClient';

export function useSyncLogs(calendarId: string) {
  return useQuery({
    queryKey: ['sync-logs', calendarId],
    queryFn: async () => {
      const { logs } = await fnGet<{ logs: SyncLog[] }>(`/sync-logs?calendar_id=${calendarId}`);
      return logs ?? [];
    },
    enabled: !!calendarId,
  });
}
