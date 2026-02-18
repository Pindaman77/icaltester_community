import { differenceInCalendarDays, format, isAfter, isBefore, parseISO, subDays } from "date-fns";
import { CloudDownload, PencilLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { TimelineEvent } from "@/hooks/useAllCalendarsBookings";

type TimelineBookingBlockProps = {
  event: TimelineEvent;
  rangeStart: Date;
  rangeEnd: Date;
  dayWidth: number;
  hasOverlap: boolean;
};

export function TimelineBookingBlock({
  event,
  rangeStart,
  rangeEnd,
  dayWidth,
  hasOverlap,
}: TimelineBookingBlockProps) {
  const navigate = useNavigate();
  const start = parseISO(event.start_date);
  const endRaw = parseISO(event.end_date);
  const end = subDays(endRaw, 1);
  const displayEnd = isBefore(end, start) ? start : end;

  const clampedStart = isBefore(start, rangeStart) ? rangeStart : start;
  const clampedEnd = isAfter(displayEnd, rangeEnd) ? rangeEnd : displayEnd;

  if (isAfter(clampedStart, clampedEnd)) {
    return null;
  }

  const offsetDays = Math.max(0, differenceInCalendarDays(clampedStart, rangeStart));
  const spanDays = Math.max(1, differenceInCalendarDays(clampedEnd, clampedStart) + 1);

  const status = String(event.status ?? "").toLowerCase();
  const statusClass =
    status === "cancelled"
      ? "opacity-50 line-through"
      : status === "tentative" || status === "pending"
        ? "border-dashed"
        : "";

  const overlapClass = hasOverlap ? "border-rose-400 bg-rose-500/15 text-rose-700" : "bg-muted/30 text-foreground";
  const calendarTint = getCalendarTint(event.calendar_color, event.source === "imported" ? 0.16 : 0.22);
  const SourceIcon = event.source === "imported" ? CloudDownload : PencilLine;
  const sourceIconClass = event.source === "imported" ? "text-indigo-600" : "text-emerald-600";
  const style = !hasOverlap && calendarTint ? calendarTint : undefined;

  const handleOpenBooking = () => {
    navigate(`/calendar/${event.calendar_id}?tab=bookings`);
  };

  return (
    <div
      className={`absolute top-2 h-8 cursor-pointer rounded-lg border px-2 text-xs font-semibold ${overlapClass} ${statusClass}`}
      style={{ left: offsetDays * dayWidth, width: spanDays * dayWidth, ...style }}
      title={`${event.summary} (${format(start, "MMM d")} - ${format(displayEnd, "MMM d")}) • ${event.source} • ${status || "unknown"}`}
      role="button"
      tabIndex={0}
      onClick={handleOpenBooking}
      onKeyDown={(eventKey) => {
        if (eventKey.key === "Enter" || eventKey.key === " ") {
          eventKey.preventDefault();
          handleOpenBooking();
        }
      }}
    >
      <span className="inline-flex items-center gap-1 truncate">
        <SourceIcon className={`h-3 w-3 shrink-0 ${sourceIconClass}`} aria-hidden="true" />
        <span className="truncate">{event.summary}</span>
      </span>
    </div>
  );
}

function getCalendarTint(color?: string, alpha = 0.2) {
  if (!color) return null;
  const rgba = toRgba(color, alpha);
  if (rgba) {
    return { backgroundColor: rgba, borderColor: color };
  }
  return { borderColor: color };
}

function toRgba(color: string, alpha: number) {
  if (!color.startsWith("#")) return null;
  let hex = color.slice(1).trim();
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((value) => value + value)
      .join("");
  }
  if (hex.length !== 6) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
