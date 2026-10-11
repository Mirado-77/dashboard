import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { WeatherService } from './weather.service.js';

const MAX_CITY_LENGTH = 100;

@Controller('weather')
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  /** The data of the widget: `GET /api/weather?city=Paris`. */
  @Get()
  current(@Query('city') city?: string) {
    const name = city?.trim() ?? '';
    if (name.length === 0 || name.length > MAX_CITY_LENGTH) {
      throw new BadRequestException(
        `Expected a city of 1 to ${MAX_CITY_LENGTH} characters`,
      );
    }
    return this.weather.current(name);
  }
}
