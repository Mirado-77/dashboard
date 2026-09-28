import { WidgetDataError } from '../errors.js';
import { parseFeed } from './parse-feed.js';

const rss = (items: string) => `<?xml version="1.0"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Tech &amp; News</title>
    <link>https://example.com</link>
    ${items}
  </channel>
</rss>`;

const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="text">Releases</title>
  <link href="https://example.com/releases" rel="alternate"/>
  <entry>
    <title>v2.0.0</title>
    <link href="https://example.com/v2.atom" rel="self"/>
    <link href="https://example.com/v2" rel="alternate"/>
    <updated>2026-09-01T10:00:00Z</updated>
    <content type="html">&lt;p&gt;Big &lt;b&gt;release&lt;/b&gt;&lt;/p&gt;</content>
  </entry>
  <entry>
    <title>v1.0.0</title>
    <link href="https://example.com/v1"/>
    <published>2026-01-01T10:00:00Z</published>
    <updated>2026-02-01T10:00:00Z</updated>
    <summary>First</summary>
  </entry>
</feed>`;

describe('parseFeed', () => {
  it('reads an RSS 2.0 feed', () => {
    const feed = parseFeed(
      rss(`
        <item>
          <title>First</title>
          <link>https://example.com/1</link>
          <pubDate>Tue, 10 Jun 2025 04:00:00 GMT</pubDate>
          <description>Hello</description>
        </item>
        <item>
          <title>Second</title>
          <link>https://example.com/2</link>
        </item>`),
    );

    expect(feed.title).toBe('Tech & News');
    expect(feed.items).toEqual([
      {
        title: 'First',
        link: 'https://example.com/1',
        date: '2025-06-10T04:00:00.000Z',
        summary: 'Hello',
      },
      {
        title: 'Second',
        link: 'https://example.com/2',
        date: null,
        summary: null,
      },
    ]);
  });

  it('gives a list even when the feed has a single item', () => {
    const feed = parseFeed(rss('<item><title>Only</title></item>'));

    expect(feed.items).toHaveLength(1);
    expect(feed.items[0].title).toBe('Only');
  });

  it('gives an empty list when the feed has no item', () => {
    expect(parseFeed(rss('')).items).toEqual([]);
  });

  it('reads an Atom feed and picks the alternate link', () => {
    const feed = parseFeed(atom);

    expect(feed.title).toBe('Releases');
    expect(feed.items[0]).toEqual({
      title: 'v2.0.0',
      link: 'https://example.com/v2',
      date: '2026-09-01T10:00:00.000Z',
      summary: 'Big release',
    });
  });

  it('prefers the published date of an Atom entry', () => {
    expect(parseFeed(atom).items[1].date).toBe('2026-01-01T10:00:00.000Z');
  });

  it('reads an RSS 1.0 (RDF) feed', () => {
    const feed = parseFeed(`<?xml version="1.0"?>
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns="http://purl.org/rss/1.0/"
               xmlns:dc="http://purl.org/dc/elements/1.1/">
        <channel><title>RDF feed</title></channel>
        <item>
          <title>Entry</title>
          <link>https://example.com/rdf</link>
          <dc:date>2026-03-04T05:06:07Z</dc:date>
        </item>
      </rdf:RDF>`);

    expect(feed.title).toBe('RDF feed');
    expect(feed.items[0]).toMatchObject({
      link: 'https://example.com/rdf',
      date: '2026-03-04T05:06:07.000Z',
    });
  });

  it('turns HTML and CDATA descriptions into a short plain text', () => {
    const long = 'word '.repeat(100);
    const feed = parseFeed(
      rss(`
        <item><title>A</title><description><![CDATA[<p>Tom &amp; Jerry&nbsp;<img src="x"/>are <i>back</i></p>]]></description></item>
        <item><title>B</title><description>${long}</description></item>`),
    );

    expect(feed.items[0].summary).toBe('Tom & Jerry are back');
    expect(feed.items[1].summary!.length).toBeLessThanOrEqual(200);
    expect(feed.items[1].summary!.endsWith('…')).toBe(true);
  });

  it('keeps a numeric title as text', () => {
    const feed = parseFeed(rss('<item><title>2026</title></item>'));

    expect(feed.items[0].title).toBe('2026');
  });

  it('drops links that are not http or https', () => {
    const feed = parseFeed(
      rss(`
        <item><title>A</title><link>javascript:alert(1)</link></item>
        <item><title>B</title><link>data:text/html,hi</link></item>
        <item><title>C</title><link>not a url</link></item>`),
    );

    expect(feed.items.map((item) => item.link)).toEqual([null, null, null]);
  });

  it('falls back to a permalink guid when there is no link', () => {
    const feed = parseFeed(
      rss(
        '<item><title>A</title><guid isPermaLink="true">https://example.com/g</guid></item>',
      ),
    );

    expect(feed.items[0].link).toBe('https://example.com/g');
  });

  it('ignores an invalid date', () => {
    const feed = parseFeed(
      rss('<item><title>A</title><pubDate>someday</pubDate></item>'),
    );

    expect(feed.items[0].date).toBeNull();
  });

  it('rejects a document that is not a feed', () => {
    expect(() => parseFeed('<html><body>Hi</body></html>')).toThrow(
      WidgetDataError,
    );
    expect(() => parseFeed('{"json": true}')).toThrow(WidgetDataError);
  });
});
