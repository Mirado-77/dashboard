import type { Service } from './../types.js';
import { listEvents } from './google-calendar.api.js';

export const googleCalendar: Service = {
  id: 'google-calendar',
  name: 'Google Calendar',
  description: 'List your Google events',
  providerType: 'oauth',
  oauthProviderId: 'google',
  oauthScopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  widgets: [
    {
      id: 'upcoming_events',
      name: 'Upcoming events',
      description: 'Get the events for the next days',
      params: [
        { name: 'days', type: 'integer', required: false, defaultValue: 7 },
      ],
      defaultRefreshRate: 600,
      minRefreshRate: 60,
      async getWidgetData({ config, accessToken }) {
        const ONE_DAY_MIL = 24 * 60 * 60 * 1000;
        const days: number = Math.min(Math.max(Number(config.days), 1), 30);
        const start = new Date();
        const period = new Date(start.getTime() + ONE_DAY_MIL * days);

        return listEvents(accessToken, { from: start, to: period, max: 20 });
      },
    },
  ],
};
