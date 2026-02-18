import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfMonth,
  subDays,
} from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarRange, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAllCalendarsBookings } from "@/hooks/useAllCalendarsBookings";
import { Layout } from "@/components/Layout";
import { TimelineView } from "@/components/calendar/TimelineView";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const zoomOptions = {
  day: { label: "Day", width: 40 },
  week: { label: "Week", width: 24 },
  month: { label: "Month", width: 14 },
} as const;

type ZoomKey = keyof typeof zoomOptions;

export default function Timeline() {
  const { user, loading: authLoading } = useAuth();
  const { calendars, rows, isLoading } = useAllCalendarsBookings();
  const queryClient = useQueryClient();
  const [zoom, setZoom] = useState<ZoomKey>("day");
  const [rangeStart, setRangeStart] = useState(() => startOfMonth(new Date()));
  const [rangeEnd, setRangeEnd] = useState(() => endOfMonth(addMonths(new Date(), 1)));
  const [visibleCalendars, setVisibleCalendars] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (calendars.length === 0) {
      setVisibleCalendars(new Set());
      return;
    }

    setVisibleCalendars((prev) => {
      const next = new Set(prev);
      let changed = false;

      calendars.forEach((calendar) => {
        if (!next.has(calendar.id)) {
          next.add(calendar.id);
          changed = true;
        }
      });

      for (const id of Array.from(next)) {
        if (!calendars.some((calendar) => calendar.id === id)) {
          next.delete(id);
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [calendars]);

  const totalDays = Math.max(1, differenceInCalendarDays(rangeEnd, rangeStart) + 1);
  const dayWidth = zoomOptions[zoom].width;
  const allSelected = calendars.length > 0 && visibleCalendars.size === calendars.length;

  const visibleRows = useMemo(
    () => rows.filter((row) => visibleCalendars.has(row.calendar.id)),
    [rows, visibleCalendars],
  );

  const overlapDays = useMemo(() => {
    const lookup = new Map<string, number>();
    visibleRows.forEach((row) => {
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

    let overlapCount = 0;
    lookup.forEach((value) => {
      if (value > 1) overlapCount += 1;
    });
    return overlapCount;
  }, [visibleRows, rangeStart, rangeEnd]);

  const handleRangeStartChange = (value: string) => {
    if (!value) return;
    const nextStart = parseISO(value);
    setRangeStart(nextStart);
    if (isAfter(nextStart, rangeEnd)) {
      setRangeEnd(nextStart);
    }
  };

  const handleRangeEndChange = (value: string) => {
    if (!value) return;
    const nextEnd = parseISO(value);
    if (isAfter(rangeStart, nextEnd)) {
      setRangeStart(nextEnd);
    }
    setRangeEnd(nextEnd);
  };

  const shiftRange = (days: number) => {
    setRangeStart((prev) => addDays(prev, days));
    setRangeEnd((prev) => addDays(prev, days));
  };

  const handleResetToToday = () => {
    const today = new Date();
    setRangeStart(startOfMonth(today));
    setRangeEnd(endOfMonth(addMonths(today, 1)));
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["calendars"] });
    queryClient.invalidateQueries({ queryKey: ["timeline-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["timeline-imported-events"] });
  };

  const toggleCalendar = (id: string, checked: boolean) => {
    setVisibleCalendars((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const toggleAllCalendars = () => {
    if (allSelected) {
      setVisibleCalendars(new Set());
      return;
    }
    setVisibleCalendars(new Set(calendars.map((calendar) => calendar.id)));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CalendarRange className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Timeline</h1>
                <p className="text-sm text-muted-foreground">
                  Compare bookings across all mock calendars to spot overlaps quickly.
                </p>
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </header>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Timeline controls</CardTitle>
              <CardDescription>Adjust the date range and zoom level.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timeline-start-date">Start date</Label>
                  <Input
                    id="timeline-start-date"
                    type="date"
                    value={format(rangeStart, "yyyy-MM-dd")}
                    onChange={(event) => handleRangeStartChange(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeline-end-date">End date</Label>
                  <Input
                    id="timeline-end-date"
                    type="date"
                    value={format(rangeEnd, "yyyy-MM-dd")}
                    onChange={(event) => handleRangeEndChange(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => shiftRange(-totalDays)} className="gap-2">
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <Button variant="outline" onClick={() => shiftRange(totalDays)} className="gap-2">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={handleResetToToday}>
                  Today
                </Button>
                <Select value={zoom} onValueChange={(value) => setZoom(value as ZoomKey)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Zoom" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(zoomOptions).map(([key, option]) => (
                      <SelectItem key={key} value={key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Filters & legend</CardTitle>
              <CardDescription>Show the calendars you want to compare.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Calendars</span>
                <Button variant="ghost" size="sm" onClick={toggleAllCalendars}>
                  {allSelected ? "Hide all" : "Show all"}
                </Button>
              </div>
              <ScrollArea className="max-h-48 pr-2">
                <div className="space-y-2">
                  {calendars.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No calendars yet.</p>
                  ) : (
                    calendars.map((calendar) => {
                      const checked = visibleCalendars.has(calendar.id);
                      const color = (calendar as { color?: string }).color;
                      return (
                        <label
                          key={calendar.id}
                          className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => toggleCalendar(calendar.id, Boolean(value))}
                          />
                          <span
                            className="h-2 w-2 rounded-full bg-primary/70"
                            style={color ? { backgroundColor: color } : undefined}
                          />
                          <span className="truncate">{calendar.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </ScrollArea>

              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                    Manual booking
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-400/70" />
                    Imported event
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                    Overlap detected
                  </span>
                </div>
                <p>Overlap days in range: {overlapDays}</p>
                <p>Cancelled events appear faded. Tentative or pending bookings use a dashed border.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : calendars.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Create a few calendars to see your unified timeline view here.
              </p>
            </CardContent>
          </Card>
        ) : visibleRows.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Select at least one calendar to populate the timeline.
              </p>
            </CardContent>
          </Card>
        ) : (
          <TimelineView rows={visibleRows} rangeStart={rangeStart} rangeEnd={rangeEnd} dayWidth={dayWidth} />
        )}
      </div>
    </Layout>
  );
}
