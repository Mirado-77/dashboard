/*
** EPITECH PROJECT, 2026
** G-WEB-500-PAR-5-1-dashboard-10
** File description:
** rss.service
*/

import type { Service } from '../types.js';
import { parseFeed, type FeedItem } from './parse-feed.js';
import { safeFetch } from './safe-fetch.js';

const MAX_ITEMS = 20;

function byDateDesc(a: FeedItem, b: FeedItem): number {
  if (a.date === b.date) return 0;
  if (a.date === null) return 1;
  if (b.date === null) return -1;
  return a.date < b.date ? 1 : -1;
}

async function loadFeed(url: unknown) {
  const feed = parseFeed(await safeFetch(String(url)));
  return { ...feed, items: [...feed.items].sort(byDateDesc) };
}

export const rss: Service = {
  id: 'rss',
  name: 'RSS',
  description: 'Articles of any RSS or Atom feed',
  providerType: 'none',
  widgets: [
    {
      id: 'article_list',
      name: 'Article list',
      description: 'Latest articles of a feed',
      params: [
        { name: 'url', type: 'string', required: true },
        { name: 'limit', type: 'integer', required: false, defaultValue: 5 },
      ],
      defaultRefreshRate: 900,
      minRefreshRate: 300,
      async getWidgetData({ config }) {
        const limit = Math.min(Math.max(Number(config.limit) || 5, 1), MAX_ITEMS);
        const feed = await loadFeed(config.url);
        return { title: feed.title, items: feed.items.slice(0, limit) };
      },
    },
    {
      id: 'latest_article',
      name: 'Latest article',
      description: 'The most recent article of a feed, with its summary',
      params: [{ name: 'url', type: 'string', required: true }],
      defaultRefreshRate: 900,
      minRefreshRate: 300,
      async getWidgetData({ config }) {
        const feed = await loadFeed(config.url);
        return { title: feed.title, item: feed.items[0] ?? null };
      },
    },
  ],
};
