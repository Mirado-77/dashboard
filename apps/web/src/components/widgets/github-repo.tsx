import { CircleDot, GitPullRequest, GitPullRequestDraft, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";
import { formatDate } from "./format";

export interface CommitsData {
  repo: string;
  commits: {
    sha: string;
    url: string;
    message: string;
    author: string | null;
    date: string | null;
  }[];
}

interface OpenItem {
  number: number;
  title: string;
  url: string;
  author: string | null;
  createdAt: string;
  comments: number;
  draft: boolean;
}

export interface OpenIssuesData {
  repo: string;
  total: number;
  issues: OpenItem[];
}

export interface OpenPullRequestsData {
  repo: string;
  total: number;
  pullRequests: OpenItem[];
}

/** Only links to GitHub itself, whatever the API hands out. */
function GitHubLink({ href, children }: { href: string; children: ReactNode }) {
  if (!href.startsWith("https://github.com/")) {
    return <span className="font-medium">{children}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline-offset-4 hover:underline"
    >
      {children}
    </a>
  );
}

function byline(author: string | null, date: string | null): string {
  return [author, formatDate(date)].filter(Boolean).join(" · ");
}

function RepoHeader({ repo, count }: { repo: string; count?: string }) {
  return (
    <p className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <span className="truncate">{repo}</span>
      {count && <span className="shrink-0 tabular-nums">{count}</span>}
    </p>
  );
}

export function GitHubCommits({ data }: { data: CommitsData }) {
  return (
    <div className="flex flex-col gap-2">
      <RepoHeader repo={data.repo} />
      {data.commits.length === 0 ? (
        <p className="text-sm text-muted-foreground">This repository has no commits.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {data.commits.map((commit) => (
            <li key={commit.sha} className="flex flex-col gap-0.5 py-1.5 text-sm">
              <GitHubLink href={commit.url}>{commit.message}</GitHubLink>
              <span className="text-xs text-muted-foreground">
                <code>{commit.sha}</code>
                {byline(commit.author, commit.date) && ` · ${byline(commit.author, commit.date)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OpenList({
  repo,
  total,
  items,
  empty,
  icon,
}: {
  repo: string;
  total: number;
  items: OpenItem[];
  empty: string;
  icon: (item: OpenItem) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <RepoHeader repo={repo} count={`${total} open`} />
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {items.map((item) => (
            <li key={item.number} className="flex gap-2 py-1.5 text-sm">
              <span className="mt-0.5 shrink-0 text-muted-foreground">{icon(item)}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <GitHubLink href={item.url}>{item.title}</GitHubLink>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">
                    #{item.number}
                    {byline(item.author, item.createdAt) &&
                      ` · ${byline(item.author, item.createdAt)}`}
                    {item.draft && " · Draft"}
                  </span>
                  {item.comments > 0 && (
                    <span className="flex shrink-0 items-center gap-1 tabular-nums">
                      <MessageSquare className="size-3" aria-hidden />
                      {item.comments}
                    </span>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GitHubOpenIssues({ data }: { data: OpenIssuesData }) {
  return (
    <OpenList
      repo={data.repo}
      total={data.total}
      items={data.issues}
      empty="No open issues."
      icon={() => <CircleDot className="size-4" aria-hidden />}
    />
  );
}

export function GitHubOpenPullRequests({ data }: { data: OpenPullRequestsData }) {
  return (
    <OpenList
      repo={data.repo}
      total={data.total}
      items={data.pullRequests}
      empty="No open pull requests."
      icon={(item) =>
        item.draft ? (
          <GitPullRequestDraft className="size-4" aria-hidden />
        ) : (
          <GitPullRequest className="size-4" aria-hidden />
        )
      }
    />
  );
}
