/*
** EPITECH PROJECT, 2026
** G-WEB-500-PAR-5-1-dashboard-10
** File description:
** github
*/

import { WidgetDataError } from '../errors.js';

const API_URL = 'https://api.github.com';
const TIMEOUT_MS = 5000;

async function gh<T>(path: string, accessToken?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'dashboard',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 401) {
    throw new WidgetDataError('Link your GitHub account again');
  }
  if (response.status === 404 || response.status === 422) {
    throw new WidgetDataError('Repository not found');
  }
  if (response.status === 409) {
    throw new WidgetDataError('This repository has no commit yet');
  }
  if (!response.ok) {
    throw new WidgetDataError(`GitHub answered ${response.status}`);
  }
  return (await response.json()) as T;
}

export function parseRepo(value: unknown): string {
  const repo = String(value).trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new WidgetDataError('Expected a repository like owner/name');
  }
  return repo;
}

interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } | null };
  author: { login: string } | null;
}

export async function getCommits(repo: string, limit: number, token?: string) {
  const commits = await gh<GitHubCommit[]>(
    `/repos/${repo}/commits?per_page=${limit}`,
    token,
  );
  return commits.map((item) => ({
    sha: item.sha.slice(0, 7),
    url: item.html_url,
    message: item.commit.message.split('\n')[0],
    author: item.author?.login ?? item.commit.author?.name ?? null,
    date: item.commit.author?.date ?? null,
  }));
}

interface GitHubIssue {
  number: number;
  title: string;
  html_url: string;
  user: { login: string } | null;
  created_at: string;
  comments: number;
  draft?: boolean;
}

export async function getOpen(
  kind: 'issue' | 'pr',
  repo: string,
  limit: number,
  token?: string,
) {
  const query = encodeURIComponent(`repo:${repo} is:${kind} is:open`);
  const result = await gh<{ total_count: number; items: GitHubIssue[] }>(
    `/search/issues?q=${query}&sort=created&order=desc&per_page=${limit}`,
    token,
  );
  return {
    total: result.total_count,
    items: result.items.map((item) => ({
      number: item.number,
      title: item.title,
      url: item.html_url,
      author: item.user?.login ?? null,
      createdAt: item.created_at,
      comments: item.comments,
      draft: item.draft ?? false,
    })),
  };
}
