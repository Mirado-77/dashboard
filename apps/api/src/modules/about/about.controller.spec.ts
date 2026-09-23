import type { Request } from 'express';
import { ServiceRegistry } from '../services/registry/registry.js';
import type { Service } from '../services/registry/types.js';
import { AboutController } from './about.controller.js';

const weather: Service = {
  id: 'weather',
  name: 'Weather',
  description: 'Weather of any city',
  providerType: 'none',
  widgets: [
    {
      id: 'city_temperature',
      name: 'City temperature',
      description: 'Display temperature for a city',
      params: [
        { name: 'city', type: 'string', required: true },
        { name: 'days', type: 'integer', required: false, defaultValue: 3 },
      ],
      defaultRefreshRate: 300,
      minRefreshRate: 30,
      getWidgetData: async () => ({ celsius: 21 }),
    },
  ],
};

function about(services: Service[], ip?: string) {
  const controller = new AboutController(new ServiceRegistry(services));
  return controller.about({ ip } as Request);
}

describe('AboutController', () => {
  it('describes every service the way the subject requires', () => {
    expect(about([weather]).server.services).toEqual([
      {
        name: 'weather',
        widgets: [
          {
            name: 'city_temperature',
            description: 'Display temperature for a city',
            params: [
              { name: 'city', type: 'string' },
              { name: 'days', type: 'integer' },
            ],
          },
        ],
      },
    ]);
  });

  it('leaves out everything the subject does not ask for', () => {
    const widget = about([weather]).server.services[0].widgets[0];

    expect(widget).not.toHaveProperty('getWidgetData');
    expect(widget).not.toHaveProperty('defaultRefreshRate');
    expect(widget.params[1]).not.toHaveProperty('defaultValue');
    expect(widget.params[1]).not.toHaveProperty('required');
  });

  it('reports an empty list when no service is registered', () => {
    expect(about([]).server.services).toEqual([]);
  });

  it('reports the client host and the server time in seconds', () => {
    const before = Math.floor(Date.now() / 1000);
    const body = about([], '::ffff:10.101.53.35');

    expect(body.client.host).toBe('10.101.53.35');
    expect(body.server.current_time).toBeGreaterThanOrEqual(before);
    expect(Number.isInteger(body.server.current_time)).toBe(true);
  });

  it('reports a null host when express has no address', () => {
    expect(about([]).client.host).toBeNull();
  });
});
