import { Wind } from "lucide-react";
import { describeWeather } from "./weather-codes";

export interface CityTemperatureData {
  city: string;
  country: string;
  temperature: number;
  windSpeed: number;
  weatherCode: number;
}

export function WeatherTemperature({ data }: { data: CityTemperatureData }) {
  const weather = describeWeather(data.weatherCode);

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-muted-foreground">
          {data.city}, {data.country}
        </p>
        <p className="text-4xl font-semibold tabular-nums">{Math.round(data.temperature)}°C</p>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          <Wind className="size-4" aria-hidden />
          {Math.round(data.windSpeed)} km/h
        </p>
      </div>
      <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
        <weather.icon className="size-10 text-foreground" aria-hidden />
        {weather.label}
      </div>
    </div>
  );
}
