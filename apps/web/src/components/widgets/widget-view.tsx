import { CalendarEvents, type CalendarEvent } from "./calendar-events";
import { RssArticleList, RssLatestArticle, type ArticleListData, type LatestArticleData } from "./rss-articles";
import { WeatherForecast, type ForecastData } from "./weather-forecast";
import { WeatherTemperature, type CityTemperatureData } from "./weather-temperature";

/** Picks the display of a widget type. The data shape is set by the API registry. */
export function WidgetView({
  serviceId,
  widgetId,
  data,
}: {
  serviceId: string;
  widgetId: string;
  data: unknown;
}) {
  switch (`${serviceId}/${widgetId}`) {
    case "weather/city_temperature":
      return <WeatherTemperature data={data as CityTemperatureData} />;
    case "weather/forecast":
      return <WeatherForecast data={data as ForecastData} />;
    case "rss/article_list":
      return <RssArticleList data={data as ArticleListData} />;
    case "rss/latest_article":
      return <RssLatestArticle data={data as LatestArticleData} />;
    case "google-calendar/upcoming_events":
      return <CalendarEvents data={data as CalendarEvent[]} showDay />;
    case "google-calendar/today_events":
      return <CalendarEvents data={data as CalendarEvent[]} showDay={false} />;
    default:
      return <p className="text-sm text-muted-foreground">This widget has no display yet.</p>;
  }
}
