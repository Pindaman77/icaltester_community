import { parseISO, subDays } from "date-fns";
import type { TimelineEvent } from "@/hooks/useAllCalendarsBookings";
import { TimelineBookingBlock } from "./TimelineBookingBlock";

type TimelineRowProps = {
  events: TimelineEvent[];
  rangeStart: Date;
  rangeEnd: Date;
  dayWidth: number;
  overlapLookup: Map<string, number>;
};

export function TimelineRow({ events, rangeStart, rangeEnd, dayWidth, overlapLookup }: TimelineRowProps) {
  return (
    <div className="relative h-14 border-b border-border/60">
      {events.map((event) => {
        const start = parseISO(event.start_date);
        const end = subDays(parseISO(event.end_date), 1);
        const displayEnd = end < start ? start : end;
        const hasOverlap = hasEventOverlap(start, displayEnd, overlapLookup);

        return (
          <TimelineBookingBlock
            key={event.id}
            event={event}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            dayWidth={dayWidth}
            hasOverlap={hasOverlap}
          />
        );
      })}
    </div>
  );
}

function hasEventOverlap(start: Date, end: Date, lookup: Map<string, number>) {
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    if ((lookup.get(key) ?? 0) > 1) {
      return true;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}
