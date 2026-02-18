import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useCalendars } from "@/hooks/useCalendars";
import { fnGet } from "@/lib/functionsClient";
import type { Booking, ImportedEvent, Calendar } from "@/integrations/supabase/client";

export type TimelineEvent = {
  id: string;
  calendar_id: string;
  calendar_color?: string;
  summary: string;
  start_date: string;
  end_date: string;
  status: string;
  source: "manual" | "imported";
};

export type TimelineCalendarRow = {
  calendar: Calendar & { color?: string };
  events: TimelineEvent[];
};

const fetchBookings = async (calendarId: string) => {
  const { events } = await fnGet<{ events: Booking[] }>(`/manual-events?calendar_id=${calendarId}`);
  return events ?? [];
};

const fetchImportedEvents = async (calendarId: string) => {
  const { events } = await fnGet<{ events: ImportedEvent[] }>(`/imported-events?calendar_id=${calendarId}`);
  return events ?? [];
};

export function useAllCalendarsBookings() {
  const calendarsQuery = useCalendars();
  const calendars = calendarsQuery.data ?? [];

  const bookingQueries = useQueries({
    queries: calendars.map((calendar) => ({
      queryKey: ["timeline-bookings", calendar.id],
      queryFn: () => fetchBookings(calendar.id),
      enabled: Boolean(calendar.id),
    })),
  });

  const importedQueries = useQueries({
    queries: calendars.map((calendar) => ({
      queryKey: ["timeline-imported-events", calendar.id],
      queryFn: () => fetchImportedEvents(calendar.id),
      enabled: Boolean(calendar.id),
    })),
  });

  const isLoading =
    calendarsQuery.isLoading || bookingQueries.some((query) => query.isLoading) || importedQueries.some((query) => query.isLoading);

  const rows = useMemo<TimelineCalendarRow[]>(
    () =>
      calendars.map((calendar, index) => {
        const manual = bookingQueries[index]?.data ?? [];
        const imported = importedQueries[index]?.data ?? [];
        const events: TimelineEvent[] = [
          ...manual.map((event) => ({
            id: event.id,
            calendar_id: event.calendar_id,
            calendar_color: (calendar as { color?: string }).color,
            summary: event.summary,
            start_date: event.start_date,
            end_date: event.end_date,
            status: event.status,
            source: "manual" as const,
          })),
          ...imported.map((event) => ({
            id: event.id,
            calendar_id: event.calendar_id,
            calendar_color: (calendar as { color?: string }).color,
            summary: event.summary,
            start_date: event.start_date,
            end_date: event.end_date,
            status: event.status,
            source: "imported" as const,
          })),
        ];

        return {
          calendar: calendar as Calendar & { color?: string },
          events,
        };
      }),
    [calendars, bookingQueries, importedQueries],
  );

  return {
    calendars,
    rows,
    isLoading,
  };
}
