import { useQuery } from '@tanstack/react-query';
import { ImportedEvent } from '@/integrations/supabase/client';
import { fnGet } from '@/lib/functionsClient';

export function useImportedEvents(calendarId: string) {
  return useQuery({
    queryKey: ['imported-events', calendarId],
    queryFn: async () => {
      const { events } = await fnGet<{ events: ImportedEvent[] }>(`/imported-events?calendar_id=${calendarId}`);
      return events ?? [];
    },
    enabled: !!calendarId,
  });
}
