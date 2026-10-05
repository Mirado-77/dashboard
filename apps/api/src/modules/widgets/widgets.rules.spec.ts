import { BadRequestException } from '@nestjs/common';
import type { Widget } from '../services/registry/types.js';
import {
  MAX_REFRESH_RATE,
  configFor,
  moveTo,
  refreshRateFor,
} from './widgets.rules.js';

const temperature: Widget = {
  id: 'temperature',
  name: 'Temperature',
  description: 'Temperature of a city',
  params: [
    { name: 'city', type: 'string', required: true },
    { name: 'days', type: 'integer', required: false, defaultValue: 3 },
  ],
  defaultRefreshRate: 300,
  minRefreshRate: 60,
  getWidgetData: async () => null,
};

describe('configFor', () => {
  it('fills in the defaults', () => {
    expect(configFor(temperature, { city: 'Paris' })).toEqual({
      city: 'Paris',
      days: 3,
    });
  });

  it('rejects a configuration that does not match the widget', () => {
    expect(() => configFor(temperature, { city: 'Paris', days: 'x' })).toThrow(
      BadRequestException,
    );
    expect(() => configFor(temperature, {})).toThrow(BadRequestException);
  });
});

describe('refreshRateFor', () => {
  it('uses the default rate when none is given', () => {
    expect(refreshRateFor(temperature)).toBe(300);
  });

  it('keeps a rate within bounds', () => {
    expect(refreshRateFor(temperature, 60)).toBe(60);
    expect(refreshRateFor(temperature, MAX_REFRESH_RATE)).toBe(
      MAX_REFRESH_RATE,
    );
  });

  it('rejects a rate out of bounds', () => {
    expect(() => refreshRateFor(temperature, 59)).toThrow(BadRequestException);
    expect(() => refreshRateFor(temperature, MAX_REFRESH_RATE + 1)).toThrow(
      BadRequestException,
    );
  });
});

describe('moveTo', () => {
  it('moves a widget up or down, shifting the ones in between', () => {
    expect(moveTo(['a', 'b', 'c', 'd'], 'd', 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(moveTo(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('clamps a position past the end', () => {
    expect(moveTo(['a', 'b', 'c'], 'a', 99)).toEqual(['b', 'c', 'a']);
  });

  it('changes nothing when the widget stays in place', () => {
    expect(moveTo(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'b', 'c']);
  });
});
