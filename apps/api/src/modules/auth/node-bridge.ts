import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';

export function toWebHeaders(req: ExpressRequest): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      headers.append(name, item);
    }
  }
  // req.ip honours the "trust proxy" setting, unlike the raw header.
  if (req.ip) headers.set('x-forwarded-for', req.ip);
  return headers;
}

/** Converts an Express request into a Web standard Request. */
export function toWebRequest(req: ExpressRequest): Request {
  const headers = toWebHeaders(req);

  const url = `${req.protocol}://${req.get('host') ?? 'localhost'}${req.originalUrl}`;
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  // Body is already parsed by Nest's JSON parser, serialize it back.
  const body =
    hasBody && req.body !== undefined && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body)
      : undefined;
  if (body) headers.set('content-type', 'application/json');
  else headers.delete('content-length');
  if (body) headers.set('content-length', String(Buffer.byteLength(body)));

  return new Request(url, { method: req.method, headers, body });
}

/** Writes a Web standard Response into an Express response. */
export async function sendWebResponse(
  res: ExpressResponse,
  response: Response,
): Promise<void> {
  res.status(response.status);
  for (const [name, value] of response.headers) {
    if (name !== 'set-cookie') res.setHeader(name, value);
  }
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) res.setHeader('set-cookie', cookies);
  res.send(Buffer.from(await response.arrayBuffer()));
}
