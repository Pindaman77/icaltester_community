import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Booking } from '@/integrations/supabase/client';
import { fnDelete, fnGet, fnPatch, fnPost } from '@/lib/functionsClient';

export function useBookings(calendarId: string) {
  return useQuery({
    queryKey: ['bookings', calendarId],
    queryFn: async () => {
      const { events } = await fnGet<{ events: Booking[] }>(`/manual-events?calendar_id=${calendarId}`);
      return events ?? [];
    },
    enabled: !!calendarId,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  const generateUid = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  return useMutation({
    mutationFn: async (booking: { 
      calendar_id: string; 
      summary: string; 
      start_date: string; 
      end_date: string;
      status?: string;
      uid?: string;
    }) => {
      const payload = { ...booking, uid: booking.uid ?? generateUid() };
      const { event } = await fnPost<{ event: Booking }>('/manual-events', payload);
      return event;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bookings', data.calendar_id] });
    },
  });
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { 
      id: string; 
      summary?: string; 
      start_date?: string; 
      end_date?: string;
      status?: string;
    }) => {
      const { event } = await fnPatch<{ event: Booking }>(`/manual-events/${id}`, updates);
      return event;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bookings', data.calendar_id] });
    },
  });
}

export function useDeleteBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, calendarId }: { id: string; calendarId: string }) => {
      await fnDelete(`/manual-events/${id}`);
      return calendarId;
    },
    onSuccess: (calendarId) => {
      queryClient.invalidateQueries({ queryKey: ['bookings', calendarId] });
    },
  });
}
