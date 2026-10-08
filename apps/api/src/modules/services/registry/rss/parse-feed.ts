/*
 ** EPITECH PROJECT, 2026
 ** G-WEB-500-PAR-5-1-dashboard-10
 ** File description:
 ** parse-feed
 */

import { XMLParser } from 'fast-xml-parser';
import { WidgetDataError } from '../errors.js';

const SUMMARY_LENGTH = 200;

export interface FeedItem {
  title: string;
  link: string | null;
  date: string | null;
  summary: string | null;
}

export interface Feed {
  title: string;
  items: FeedItem[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  removeNSPrefix: true,
  htmlEntities: true,
  isArray: (tagName, _jPath, _isLeaf, isAttribute) =>
    !isAttribute && ['item', 'entry', 'link'].includes(tagName),
});

type Node = Record<string, unknown>;

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (isNode(value)) return text(value['#text']);
  return '';
}

function httpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/**
 * RSS gives <link>https://…</link>, Atom gives <link href="…" rel="…"/>,
 * sometimes several of them. The page of the article is the alternate one.
 */
function pickLink(value: unknown): string | null {
  const links = Array.isArray(value) ? value : [value];
  const candidates: string[] = [];
  for (const link of links) {
    if (typeof link === 'string') {
      candidates.push(link.trim());
    } else if (isNode(link)) {
      const href = link['@_href'];
      const rel = link['@_rel'];
      if (typeof href !== 'string') {
        candidates.push(text(link));
      } else if (rel === undefined || rel === 'alternate') {
        candidates.unshift(href);
      }
    }
  }
  for (const candidate of candidates) {
    const url = httpUrl(candidate);
    if (url) return url;
  }
  return null;
}

function toIsoDate(...values: unknown[]): string | null {
  for (const value of values) {
    const raw = text(value);
    if (!raw) continue;
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      if (entity[0] === '#') {
        const code =
          entity[1].toLowerCase() === 'x'
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
      }
      return ENTITIES[entity.toLowerCase()] ?? match;
    },
  );
}

function toSummary(value: unknown): string | null {
  const plain = decodeEntities(text(value).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return null;
  return plain.length > SUMMARY_LENGTH
    ? `${plain.slice(0, SUMMARY_LENGTH - 1).trimEnd()}…`
    : plain;
}

function toTitle(value: unknown): string {
  return decodeEntities(text(value).replace(/<[^>]*>/g, '')).trim();
}

function rssItem(item: Node): FeedItem {
  const summary = toSummary(item.description ?? item.encoded);
  return {
    title: toTitle(item.title) || summary || 'Untitled',
    link: pickLink(item.link) ?? pickLink(item.guid),
    date: toIsoDate(item.pubDate, item.date),
    summary,
  };
}

function atomEntry(entry: Node): FeedItem {
  const summary = toSummary(entry.summary ?? entry.content);
  return {
    title: toTitle(entry.title) || summary || 'Untitled',
    link: pickLink(entry.link),
    date: toIsoDate(entry.published, entry.updated),
    summary,
  };
}

function nodes(value: unknown): Node[] {
  return Array.isArray(value) ? value.filter(isNode) : [];
}

export function parseFeed(xml: string): Feed {
  let document: unknown;
  try {
    document = parser.parse(xml);
  } catch {
    throw new WidgetDataError('Feed is not valid XML');
  }
  if (!isNode(document)) throw new WidgetDataError('Not an RSS or Atom feed');

  if (isNode(document.rss) && isNode(document.rss.channel)) {
    const channel = document.rss.channel;
    return {
      title: toTitle(channel.title),
      items: nodes(channel.item).map(rssItem),
    };
  }
  if (isNode(document.feed)) {
    const feed = document.feed;
    return {
      title: toTitle(feed.title),
      items: nodes(feed.entry).map(atomEntry),
    };
  }
  if (isNode(document.RDF)) {
    const rdf = document.RDF;
    return {
      title: isNode(rdf.channel) ? toTitle(rdf.channel.title) : '',
      items: nodes(rdf.item).map(rssItem),
    };
  }
  throw new WidgetDataError('Not an RSS or Atom feed');
}
