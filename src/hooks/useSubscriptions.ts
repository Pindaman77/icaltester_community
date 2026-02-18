import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Subscription } from '@/integrations/supabase/client';
import { fnDelete, fnGet, fnPatch, fnPost } from '@/lib/functionsClient';
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/integrations/supabase/client';

export function useSubscriptions(calendarId: string) {
  return useQuery({
    queryKey: ['subscriptions', calendarId],
    queryFn: async () => {
      const { subscriptions } = await fnGet<{ subscriptions: Subscription[] }>(
        `/subscriptions?calendar_id=${calendarId}`,
      );
      return subscriptions ?? [];
    },
    enabled: !!calendarId,
  });
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subscription: { 
      calendar_id: string; 
      name: string; 
      ical_url: string;
      poll_interval_sec?: number;
    }) => {
      const { subscription: created } = await fnPost<{ subscription: Subscription }>('/subscriptions', subscription);
      return created;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', data.calendar_id] });
    },
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      calendarId, 
      ...updates 
    }: { 
      id: string; 
      calendarId: string; 
      name?: string; 
      ical_url?: string; 
      poll_interval_sec?: number;
    }) => {
      const { subscription: updated } = await fnPatch<{ subscription: Subscription }>(`/subscriptions/${id}`, updates);
      return { ...updated, calendarId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', data.calendarId] });
    },
  });
}

export function useDeleteSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, calendarId }: { id: string; calendarId: string }) => {
      await fnDelete(`/subscriptions/${id}`);
      return calendarId;
    },
    onSuccess: (calendarId) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', calendarId] });
    },
  });
}

export function useSyncSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subscriptionId, calendarId }: { subscriptionId: string; calendarId: string }) => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const functionsBase = (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string) || `${SUPABASE_URL}/functions/v1`;
      const res = await fetch(`${functionsBase}/ics-sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'sync-subscription', subscription_id: subscriptionId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Sync failed');
      return { ...json, calendarId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', data.calendarId] });
      queryClient.invalidateQueries({ queryKey: ['importedEvents', data.calendarId] });
      queryClient.invalidateQueries({ queryKey: ['syncLogs', data.calendarId] });
    },
  });
}
