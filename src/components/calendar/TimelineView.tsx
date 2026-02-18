import { useMemo, useRef } from "react";
import { eachDayOfInterval, isAfter, isBefore, parseISO, subDays } from "date-fns";
import type { TimelineCalendarRow } from "@/hooks/useAllCalendarsBookings";
import { TimelineDateAxis } from "./TimelineDateAxis";
import { TimelineRow } from "./TimelineRow";

type TimelineViewProps = {
  rows: TimelineCalendarRow[];
  rangeStart: Date;
  rangeEnd: Date;
  dayWidth: number;
};

export function TimelineView({ rows, rangeStart, rangeEnd, dayWidth }: TimelineViewProps) {
  const days = useMemo(() => eachDayOfInterval({ start: rangeStart, end: rangeEnd }), [rangeStart, rangeEnd]);
  const totalWidth = Math.max(days.length * dayWidth, 400);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isSyncingRef = useRef(false);

  const overlapLookup = useMemo(() => {
    const lookup = new Map<string, number>();
    rows.forEach((row) => {
      row.events.forEach((event) => {
        const start = parseISO(event.start_date);
        const end = subDays(parseISO(event.end_date), 1);
        const displayEnd = isBefore(end, start) ? start : end;
        const clampedStart = isBefore(start, rangeStart) ? rangeStart : start;
        const clampedEnd = isAfter(displayEnd, rangeEnd) ? rangeEnd : displayEnd;
        if (isAfter(clampedStart, clampedEnd)) return;

        const cursor = new Date(clampedStart);
        while (cursor <= clampedEnd) {
          const key = cursor.toISOString().slice(0, 10);
          lookup.set(key, (lookup.get(key) ?? 0) + 1);
          cursor.setDate(cursor.getDate() + 1);
        }
      });
    });
    return lookup;
  }, [rows, rangeStart, rangeEnd]);

  const syncScroll = (source: HTMLDivElement | null, targets: Array<HTMLDivElement | null>) => {
    if (!source || isSyncingRef.current) return;
    isSyncingRef.current = true;
    const left = source.scrollLeft;
    targets.forEach((target) => {
      if (target) target.scrollLeft = left;
    });
    requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  };

  const handleScrollBar = () => syncScroll(scrollRef.current, [headerRef.current, bodyRef.current]);
  const handleBodyScroll = () => syncScroll(bodyRef.current, [headerRef.current, scrollRef.current]);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="grid grid-cols-[220px_1fr] border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <div className="px-4 py-3">Calendars</div>
        <div className="px-4 py-3">Timeline</div>
      </div>

      <div className="grid grid-cols-[220px_1fr]">
        <div className="border-r border-border bg-muted/10">
          <div className="flex h-10 items-center border-b border-border/60 px-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Dates
          </div>
          <div className="h-6 border-b border-border/60 bg-muted/5" />
          {rows.map((row) => (
            <div key={row.calendar.id} className="flex h-14 items-center border-b border-border/60 px-4 text-sm font-medium">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full bg-primary/70"
                  style={row.calendar.color ? { backgroundColor: row.calendar.color } : undefined}
                />
                <span className="truncate">{row.calendar.name}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex min-w-0 flex-col">
          <div ref={headerRef} className="overflow-x-hidden">
            <div style={{ width: totalWidth }} className="min-w-full">
              <TimelineDateAxis days={days} dayWidth={dayWidth} />
            </div>
          </div>

          <div
            ref={scrollRef}
            onScroll={handleScrollBar}
            className="h-6 overflow-x-scroll overflow-y-hidden border-b border-border/60 bg-muted/5"
            style={{ scrollbarGutter: "stable" }}
          >
            <div style={{ width: totalWidth }} className="h-6 min-w-full" />
          </div>

          <div ref={bodyRef} onScroll={handleBodyScroll} className="overflow-x-auto hide-scrollbar">
            <div style={{ width: totalWidth }} className="min-w-full">
              {rows.map((row) => (
                <TimelineRow
                  key={row.calendar.id}
                  events={row.events}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  dayWidth={dayWidth}
                  overlapLookup={overlapLookup}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
