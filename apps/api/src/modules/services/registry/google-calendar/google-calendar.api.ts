import { WidgetDataError } from '../errors.js';

const GOOGLE_API_CALENDAR =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const TIMEOUT_MS = 5000;

interface GoogleEvent {
  id: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  start: {
    date?: string;
    dateTime?: string;
  };
  end: {
    date?: string;
    dateTime?: string;
  };
}

interface GoogleCalendarResponse {
  items?: GoogleEvent[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  link: string | null;
}

async function getGoogleEvent(
  url: URL,
  token: string,
): Promise<GoogleCalendarResponse> {
  const header: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: header,
  });

  if (!response.ok) {
    switch (response.status) {
      case 401:
        throw new WidgetDataError('Please reconnect your Google account.');
      case 403:
        throw new WidgetDataError('Allow access to your Google Calendar');
      case 429:
        throw new WidgetDataError('Too many requests, please try again later.');
      default:
        throw new WidgetDataError(
          `Google Calendar answered ${response.status}`,
        );
    }
  }
  return (await response.json()) as GoogleCalendarResponse;
}

function toCalendarEvent(event: GoogleEvent): CalendarEvent {
  let startValue = event.start.dateTime
    ? event.start.dateTime
    : event.start.date;
  let endValue = event.end.dateTime ? event.end.dateTime : event.end.date;
  if (!startValue) startValue = '';
  if (!endValue) endValue = '';

  const calendarEvent: CalendarEvent = {
    id: event.id,
    title: event.summary ? event.summary : '(No title)',
    allDay: event.start.dateTime ? false : true,
    start: startValue,
    end: endValue,
    location: event.location ? event.location : null,
    link: event.htmlLink ? event.htmlLink : null,
  };

  return calendarEvent;
}

export async function listEvents(
  accessToken: string | undefined,
  options: { from: Date; to?: Date; max: number },
): Promise<CalendarEvent[]> {
  if (!accessToken) throw new WidgetDataError('Connect your Google account');

  const url = new URL(GOOGLE_API_CALENDAR);
  url.searchParams.set('timeMin', options.from.toISOString());
  if (options.to) url.searchParams.set('timeMax', options.to.toISOString());
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set(
    'maxResults',
    String(Math.min(Math.max(options.max, 1), 50)),
  );

  const googleEvents = await getGoogleEvent(url, accessToken);

  return (googleEvents.items ?? []).map(toCalendarEvent);
}
