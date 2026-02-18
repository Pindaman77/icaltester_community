import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { fnDelete, fnGet, fnPatch, fnPost, publicIcsPath, publicIcsUrl } from '@/lib/functionsClient';

export function useCalendars() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['calendars', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { calendars } = await fnGet<{ calendars: Calendar[] }>('/calendars');
      return (calendars ?? []).map((calendar) => ({
        ...calendar,
        public_feed_url: publicIcsUrl(calendar.feed_token),
        public_feed_path: publicIcsPath(calendar.feed_token),
      }));
    },
    enabled: !!user,
  });
}

export function useCalendar(id: string) {
  return useQuery({
    queryKey: ['calendar', id],
    queryFn: async () => {
      const { calendars } = await fnGet<{ calendars: Calendar[] }>('/calendars');
      const calendar = (calendars ?? []).find((item) => item.id === id) ?? null;
      if (!calendar) return null;
      return {
        ...calendar,
        public_feed_url: publicIcsUrl(calendar.feed_token),
        public_feed_path: publicIcsPath(calendar.feed_token),
      } as Calendar;
    },
    enabled: !!id,
  });
}

export function useCreateCalendar() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('Not authenticated');
      const { calendar } = await fnPost<{ calendar: Calendar }>('/calendars', { name });
      return {
        ...calendar,
        public_feed_url: publicIcsUrl(calendar.feed_token),
        public_feed_path: publicIcsPath(calendar.feed_token),
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars'] });
    },
  });
}

export function useUpdateCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      { id, ...updates }: { id: string; name?: string; poll_interval_minutes?: number; include_imported_in_export?: boolean; default_booking_status?: 'pending' | 'tentative' | 'confirmed' },
    ) => {
      const { calendar } = await fnPatch<{ calendar: Calendar }>(`/calendars/${id}`, updates);
      return calendar;
    },
    onSuccess: (data) => {
      const withPublic = {
        ...data,
        public_feed_url: publicIcsUrl(data.feed_token),
        public_feed_path: publicIcsPath(data.feed_token),
      } as Calendar;
      queryClient.setQueryData(['calendar', data.id], (prev: Calendar | null | undefined) => (prev ? { ...prev, ...withPublic } : withPublic));
      queryClient.setQueriesData({ queryKey: ['calendars'] }, (prev) => {
        const calendars = prev as Calendar[] | undefined;
        if (!calendars) return prev;
        return calendars.map((calendar) => (calendar.id === data.id ? { ...calendar, ...withPublic } : calendar));
      });
      queryClient.invalidateQueries({ queryKey: ['calendars'] });
      queryClient.invalidateQueries({ queryKey: ['calendar', data.id] });
    },
  });
}

export function useDeleteCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await fnDelete(`/calendars/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars'] });
    },
  });
}
