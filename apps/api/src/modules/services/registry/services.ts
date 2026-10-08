import type { Service } from './types.js';
import { rss } from './rss/rss.service.js';
import { weather } from './weather/weather.service.js';
import { googleCalendar } from './google-calendar/google-calendar.service.js';

/** Every service the application offers. Add a new one here. */
export const services: Service[] = [weather, rss, googleCalendar];
