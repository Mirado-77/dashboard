import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 5000;

interface Place {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface Forecast {
  current: {
    temperature_2m: number;
    wind_speed_10m: number;
    weather_code: number;
  };
}

export interface CityWeather {
  city: string;
  country: string;
  temperature: number;
  windSpeed: number;
  weatherCode: number;
}

/** Calls Open-Meteo: the browser never talks to the external API. */
@Injectable()
export class WeatherService {
  private async getJson<T>(url: URL): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new BadGatewayException('The weather service could not be reached');
    }
    if (!response.ok) {
      throw new BadGatewayException(`Open-Meteo answered ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async current(city: string): Promise<CityWeather> {
    const geocoding = new URL(GEOCODING_URL);
    geocoding.searchParams.set('name', city);
    geocoding.searchParams.set('count', '1');
    const { results } = await this.getJson<{ results?: Place[] }>(geocoding);
    const place = results?.[0];
    if (!place) throw new NotFoundException(`Unknown city: ${city}`);

    const forecast = new URL(FORECAST_URL);
    forecast.searchParams.set('latitude', String(place.latitude));
    forecast.searchParams.set('longitude', String(place.longitude));
    forecast.searchParams.set(
      'current',
      'temperature_2m,weather_code,wind_speed_10m',
    );
    const { current } = await this.getJson<Forecast>(forecast);

    // Only what the widget displays is sent to the browser.
    return {
      city: place.name,
      country: place.country,
      temperature: current.temperature_2m,
      windSpeed: current.wind_speed_10m,
      weatherCode: current.weather_code,
    };
  }
}
