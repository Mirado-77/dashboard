import { rss } from './rss.service.js';

const FEED_URL = 'http://93.184.216.34/feed';

const feed = `<rss version="2.0"><channel><title>Blog</title>
  <item><title>Old</title><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item>
  <item><title>Undated</title></item>
  <item><title>New</title><pubDate>Wed, 01 Jan 2025 00:00:00 GMT</pubDate></item>
  <item><title>Middle</title><pubDate>Sat, 01 Jun 2024 00:00:00 GMT</pubDate></item>
</channel></rss>`;

function widget(id: string) {
  const found = rss.widgets.find((w) => w.id === id);
  if (!found) throw new Error(`Missing widget ${id}`);
  return found;
}

describe('rss service', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(feed)),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists the newest articles first, undated ones last', async () => {
    const data = await widget('article_list').getWidgetData({
      config: { url: FEED_URL, limit: 10 },
    });

    expect(data).toMatchObject({
      title: 'Blog',
      items: [
        { title: 'New' },
        { title: 'Middle' },
        { title: 'Old' },
        { title: 'Undated' },
      ],
    });
  });

  it('keeps at most `limit` articles', async () => {
    const data = (await widget('article_list').getWidgetData({
      config: { url: FEED_URL, limit: 2 },
    })) as { items: unknown[] };

    expect(data.items).toHaveLength(2);
  });

  it('bounds the limit', async () => {
    const data = (await widget('article_list').getWidgetData({
      config: { url: FEED_URL, limit: -3 },
    })) as { items: unknown[] };

    expect(data.items).toHaveLength(1);
  });

  it('gives the latest article', async () => {
    const data = await widget('latest_article').getWidgetData({
      config: { url: FEED_URL },
    });

    expect(data).toMatchObject({ title: 'Blog', item: { title: 'New' } });
  });
});
