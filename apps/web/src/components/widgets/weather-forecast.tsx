import { describeWeather } from "./weather-codes";
import { formatDay } from "./format";

export interface ForecastData {
  city: string;
  days: { date: string; min: number; max: number; weatherCode: number }[];
}

export function WeatherForecast({ data }: { data: ForecastData }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{data.city}</p>
      <ul className="flex flex-col divide-y">
        {data.days.map((day) => {
          const weather = describeWeather(day.weatherCode);
          return (
            <li key={day.date} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="w-28 shrink-0">{formatDay(day.date)}</span>
              <span className="flex flex-1 items-center gap-2 text-muted-foreground">
                <weather.icon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{weather.label}</span>
              </span>
              <span className="tabular-nums">
                {Math.round(day.min)}° / {Math.round(day.max)}°
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
