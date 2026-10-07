import { formatDate } from "./format";

export interface FeedItem {
  title: string;
  link: string | null;
  date: string | null;
  summary: string | null;
}

export interface ArticleListData {
  title: string;
  items: FeedItem[];
}

export interface LatestArticleData {
  title: string;
  item: FeedItem | null;
}

/** Only http(s) links: a feed could hand out `javascript:` ones. */
function safeLink(link: string | null): string | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function ArticleTitle({ item }: { item: FeedItem }) {
  const href = safeLink(item.link);
  if (!href) return <span className="font-medium">{item.title}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline-offset-4 hover:underline"
    >
      {item.title}
    </a>
  );
}

export function RssArticleList({ data }: { data: ArticleListData }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{data.title}</p>
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">This feed has no articles.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {data.items.map((item, index) => (
            <li key={item.link ?? index} className="flex flex-col gap-0.5 py-1.5 text-sm">
              <ArticleTitle item={item} />
              {formatDate(item.date) && (
                <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RssLatestArticle({ data }: { data: LatestArticleData }) {
  const { item } = data;

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-muted-foreground">{data.title}</p>
      {item ? (
        <>
          <ArticleTitle item={item} />
          {formatDate(item.date) && (
            <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
          )}
          {item.summary && <p className="line-clamp-4 text-muted-foreground">{item.summary}</p>}
        </>
      ) : (
        <p className="text-muted-foreground">This feed has no articles.</p>
      )}
    </div>
  );
}
