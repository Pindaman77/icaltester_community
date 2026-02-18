import { format } from "date-fns";

type TimelineDateAxisProps = {
  days: Date[];
  dayWidth: number;
};

export function TimelineDateAxis({ days, dayWidth }: TimelineDateAxisProps) {
  const labelEvery = dayWidth <= 16 ? 7 : dayWidth <= 24 ? 3 : 1;

  return (
    <div className="flex h-10 border-b border-border bg-muted/40 text-xs text-muted-foreground">
      {days.map((day, index) => {
        const isMonthStart = day.getDate() === 1;
        const showLabel = isMonthStart || index % labelEvery === 0;
        const label =
          !showLabel ? "" : isMonthStart || labelEvery >= 7 ? format(day, "MMM d") : format(day, "d");
        return (
          <div
            key={day.toISOString()}
            className="flex h-10 items-center justify-center border-r border-border/60"
            style={{ width: dayWidth }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}
