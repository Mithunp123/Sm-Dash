import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type CalendarEvent = {
  id: number | string;
  title: string;
  date: string; // ISO date or datetime
};

export type CalendarMonthProps = {
  month?: number; // 0-11, defaults to current
  year?: number; // full year, defaults to current
  events?: CalendarEvent[];
  onDayClick?: (isoDate: string) => void;
  className?: string;
  showHeader?: boolean;
};

function startOfMonth(date: Date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date: Date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const CalendarMonth = ({
  month,
  year,
  events = [],
  onDayClick,
  className,
  showHeader = true
}: CalendarMonthProps) => {
  const todayISO = useMemo(() => formatISODate(new Date()), []);

  const { gridDays, monthLabel } = useMemo(() => {
    const now = new Date();
    const base = new Date(
      year ?? now.getFullYear(),
      month ?? now.getMonth(),
      1
    );
    const start = startOfMonth(base);
    const end = endOfMonth(base);

    // Weekday where Sunday=0 .. Saturday=6
    const firstWeekday = start.getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = end.getDate();

    const days: { date: Date; iso: string; inMonth: boolean }[] = [];

    // days before month start to fill first week
    if (firstWeekday > 0) {
      // compute the starting date for the grid (start of week containing the 1st)
      const gridStart = new Date(start);
      gridStart.setDate(start.getDate() - firstWeekday);
      for (let i = 0; i < firstWeekday; i++) {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        days.push({ date: d, iso: formatISODate(d), inMonth: false });
      }
    }

    // days in month
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(start);
      d.setDate(i);
      days.push({ date: d, iso: formatISODate(d), inMonth: true });
    }

    // fill remaining cells to complete the last week
    while (days.length % 7 !== 0) {
      const last = days.length > 0 ? days[days.length - 1].date : end;
      const d = new Date(last);
      d.setDate(last.getDate() + 1);
      days.push({ date: d, iso: formatISODate(d), inMonth: false });
    }

    // optionally expand to full 6 weeks for consistent height
    while (days.length < 42) {
      const last = days[days.length - 1].date;
      const d = new Date(last);
      d.setDate(last.getDate() + 1);
      days.push({ date: d, iso: formatISODate(d), inMonth: false });
    }

    const label = base.toLocaleString(undefined, {
      month: "long",
      year: "numeric"
    });

    return { gridDays: days, monthLabel: label };
  }, [month, year]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((e) => {
      const date = new Date(e.date);
      const key = formatISODate(date);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [events]);

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className={cn("w-full", className)}>
      {showHeader && (
        <div className="flex items-center justify-between mb-2">
          <div className="text-lg font-semibold">{monthLabel}</div>
        </div>
      )}
      <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-1">
        {weekdayLabels.map((w) => (
          <div key={w} className="px-2 py-1 text-center">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {gridDays.map(({ date, iso, inMonth }) => {
          const day = date.getDate();
          const dayEvents = eventsByDay[iso] || [];
          const isToday = iso === todayISO;
          return (
            <button
              key={iso + String(inMonth)}
              type="button"
              onClick={() => onDayClick && onDayClick(iso)}
              className={cn(
                "min-h-[96px] rounded-md border p-1 text-left hover:bg-accent transition-colors",
                !inMonth && "opacity-50",
                isToday && "border-primary"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs">{weekdayLabels[date.getDay()]}</span>
                <span className={cn("text-xs px-1 rounded", isToday && "bg-primary text-primary-foreground")}>
                  {day}
                </span>
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div
                    key={String(ev.id)}
                    className="truncate rounded bg-primary/10 px-1 py-0.5 text-xs"
                    title={ev.title}
                  >
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarMonth;


