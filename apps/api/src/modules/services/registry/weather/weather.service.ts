/*
 ** EPITECH PROJECT, 2026
 ** G-WEB-500-PAR-5-1-dashboard-10
 ** File description:
 ** weather.service
 */

import type { Service } from './../types.js';
import { findCity, getForecast } from './open-meteo.js';

export const weather: Service = {
  id: 'weather',
  name: 'Weather',
  description: 'Weather forecasts by Open-Meteo',
  providerType: 'none',
  widgets: [
    {
      id: 'city_temperature',
      name: 'City temperature',
      description: 'Current temperature of a city',
      params: [{ name: 'city', type: 'string', required: true }],
      defaultRefreshRate: 600,
      minRefreshRate: 60,
      async getWidgetData({ config }) {
        const place = await findCity(String(config.city));
        const { current } = await getForecast(place, 1);
        return {
          city: place.name,
          country: place.country,
          temperature: current.temperature_2m,
          windSpeed: current.wind_speed_10m,
          weatherCode: current.weather_code,
        };
      },
    },
    {
      id: 'forecast',
      name: 'Forecast',
      description: 'Forecast of a city for the coming days',
      params: [
        { name: 'city', type: 'string', required: true },
        { name: 'days', type: 'integer', required: false, defaultValue: 3 },
      ],
      defaultRefreshRate: 1800,
      minRefreshRate: 300,
      async getWidgetData({ config }) {
        const days = Math.min(Math.max(Number(config.days), 1), 16); // limite de l'API
        const place = await findCity(String(config.city));
        const { daily } = await getForecast(place, days);
        return {
          city: place.name,
          days: daily.time.map((date, i) => ({
            date,
            min: daily.temperature_2m_min[i],
            max: daily.temperature_2m_max[i],
            weatherCode: daily.weather_code[i],
          })),
        };
      },
    },
  ],
};
