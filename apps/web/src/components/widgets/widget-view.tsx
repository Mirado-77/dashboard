import {
  GitHubCommits,
  GitHubOpenIssues,
  GitHubOpenPullRequests,
  type CommitsData,
  type OpenIssuesData,
  type OpenPullRequestsData,
} from "./github-repo";
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
    case "github/last_commits":
      return <GitHubCommits data={data as CommitsData} />;
    case "github/open_issues":
      return <GitHubOpenIssues data={data as OpenIssuesData} />;
    case "github/open_pull_requests":
      return <GitHubOpenPullRequests data={data as OpenPullRequestsData} />;
    default:
      return <p className="text-sm text-muted-foreground">This widget has no display yet.</p>;
  }
}
