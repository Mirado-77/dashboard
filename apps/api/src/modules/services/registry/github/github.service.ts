/*
** EPITECH PROJECT, 2026
** G-WEB-500-PAR-5-1-dashboard-10
** File description:
** github.service
*/

import type { Service, WidgetParam } from '../types.js';
import { getCommits, getOpen, parseRepo } from './github.js';

const MAX_ITEMS = 20;

const params: WidgetParam[] = [
  { name: 'repo', type: 'string', required: true },
  { name: 'limit', type: 'integer', required: false, defaultValue: 5 },
];

function limitOf(value: unknown): number {
  return Math.min(Math.max(Number(value) || 5, 1), MAX_ITEMS);
}

export const github: Service = {
  id: 'github',
  name: 'GitHub',
  description: 'Commits, issues and pull requests of a repository',
  providerType: 'oauth',
  widgets: [
    {
      id: 'last_commits',
      name: 'Last commits',
      description: 'Latest commits of a repository',
      params,
      defaultRefreshRate: 600,
      minRefreshRate: 120,
      async getWidgetData({ config, accessToken }) {
        const repo = parseRepo(config.repo);
        return {
          repo,
          commits: await getCommits(repo, limitOf(config.limit), accessToken),
        };
      },
    },
    {
      id: 'open_issues',
      name: 'Open issues',
      description: 'Open issues of a repository, newest first',
      params,
      defaultRefreshRate: 600,
      minRefreshRate: 300,
      async getWidgetData({ config, accessToken }) {
        const repo = parseRepo(config.repo);
        const open = await getOpen('issue', repo, limitOf(config.limit), accessToken);
        return { repo, total: open.total, issues: open.items };
      },
    },
    {
      id: 'open_pull_requests',
      name: 'Open pull requests',
      description: 'Open pull requests of a repository, newest first',
      params,
      defaultRefreshRate: 600,
      minRefreshRate: 300,
      async getWidgetData({ config, accessToken }) {
        const repo = parseRepo(config.repo);
        const open = await getOpen('pr', repo, limitOf(config.limit), accessToken);
        return { repo, total: open.total, pullRequests: open.items };
      },
    },
  ],
};
