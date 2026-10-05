/*
** EPITECH PROJECT, 2026
** G-WEB-500-PAR-5-1-dashboard-10
** File description:
** safe-fetch
*/

import { lookup } from 'node:dns/promises';
import { BlockList } from 'node:net';
import { WidgetDataError } from '../errors.js';

const TIMEOUT_MS = 5000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const blocked = new BlockList();
blocked.addSubnet('0.0.0.0', 8);
blocked.addSubnet('10.0.0.0', 8);
blocked.addSubnet('100.64.0.0', 10);
blocked.addSubnet('127.0.0.0', 8);
blocked.addSubnet('169.254.0.0', 16);
blocked.addSubnet('172.16.0.0', 12);
blocked.addSubnet('192.168.0.0', 16);
blocked.addAddress('::', 'ipv6');
blocked.addAddress('::1', 'ipv6');
blocked.addSubnet('fc00::', 7, 'ipv6');
blocked.addSubnet('fe80::', 10, 'ipv6');

async function assertAllowedUrl(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new WidgetDataError('Only http and https URLs are allowed');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new WidgetDataError(`Unknown host: ${host}`);
  }
  for (const { address, family } of addresses) {
    if (blocked.check(address, family === 6 ? 'ipv6' : 'ipv4')) {
      throw new WidgetDataError('URL not allowed');
    }
  }
}

async function readLimitedText(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new WidgetDataError('Feed is too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function safeFetch(rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new WidgetDataError('Invalid URL');
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertAllowedUrl(url);

    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          accept:
            'application/rss+xml, application/atom+xml, application/xml, text/xml',
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new WidgetDataError('Feed timed out');
      }
      throw new WidgetDataError('Feed could not be reached');
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new WidgetDataError('Redirect without location');
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) {
      throw new WidgetDataError(`Feed answered ${response.status}`);
    }
    return readLimitedText(response);
  }
  throw new WidgetDataError('Too many redirects');
}
