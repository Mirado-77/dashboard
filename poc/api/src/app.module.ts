import { Module } from '@nestjs/common';
import { WeatherController } from './weather/weather.controller.js';
import { WeatherService } from './weather/weather.service.js';

@Module({
  controllers: [WeatherController],
  providers: [WeatherService],
})
export class AppModule {}
