import { MapPin } from "lucide-react";
import { formatDay } from "./format";
import { safeLink } from "./rss-articles";

// Mirrors CalendarEvent in apps/api/src/modules/services/registry/google-calendar/google-calendar.api.ts.
export interface CalendarEvent {
  id: string;
  title: string;
  /** `2026-10-09T14:00:00+02:00`, or `2026-10-09` for an all-day event. */
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  link: string | null;
}

function formatTime(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function EventTitle({ event }: { event: CalendarEvent }) {
  const href = safeLink(event.link);
  if (!href) return <span className="font-medium">{event.title}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline-offset-4 hover:underline"
    >
      {event.title}
    </a>
  );
}

export function CalendarEvents({
  data,
  showDay,
}: {
  data: CalendarEvent[];
  /** Upcoming events span several days; today's events do not need it. */
  showDay: boolean;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No events.</p>;
  }

  return (
    <ul className="flex flex-col divide-y">
      {data.map((event) => (
        <li key={event.id} className="flex gap-3 py-1.5 text-sm">
          <div className="w-24 shrink-0 text-muted-foreground">
            {showDay && <p>{formatDay(event.start.slice(0, 10))}</p>}
            <p className="tabular-nums">
              {event.allDay ? "All day" : `${formatTime(event.start)} – ${formatTime(event.end)}`}
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <EventTitle event={event} />
            {event.location && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{event.location}</span>
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
