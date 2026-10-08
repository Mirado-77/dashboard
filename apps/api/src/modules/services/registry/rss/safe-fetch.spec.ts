import { WidgetDataError } from '../errors.js';
import { safeFetch } from './safe-fetch.js';

// An IP literal resolves without any network, so the DNS check stays offline.
const PUBLIC_URL = 'http://93.184.216.34/feed';

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { location } });
}

describe('safeFetch', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the body of a public URL', async () => {
    fetchMock.mockResolvedValue(new Response('<rss/>'));

    await expect(safeFetch(PUBLIC_URL)).resolves.toBe('<rss/>');
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(PUBLIC_URL),
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it.each([
    'http://localhost/',
    'http://127.0.0.1:8080/about.json',
    'http://10.1.2.3/',
    'http://172.18.0.2:5432/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://0.0.0.0/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[fd00::1]/',
  ])('refuses the internal address %s', async (url) => {
    await expect(safeFetch(url)).rejects.toThrow('URL not allowed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['file:///etc/passwd', 'ftp://example.com/feed', 'javascript:1'])(
    'refuses the protocol of %s',
    async (url) => {
      await expect(safeFetch(url)).rejects.toThrow(
        'Only http and https URLs are allowed',
      );
    },
  );

  it('refuses a malformed URL', async () => {
    await expect(safeFetch('not a url')).rejects.toThrow('Invalid URL');
  });

  it('follows a redirect to another public URL', async () => {
    fetchMock
      .mockResolvedValueOnce(redirect('/moved'))
      .mockResolvedValueOnce(new Response('<feed/>'));

    await expect(safeFetch(PUBLIC_URL)).resolves.toBe('<feed/>');
    expect(fetchMock.mock.calls[1][0]).toEqual(
      new URL('http://93.184.216.34/moved'),
    );
  });

  it('refuses a redirect to an internal address', async () => {
    fetchMock.mockResolvedValueOnce(redirect('http://127.0.0.1:8080/'));

    await expect(safeFetch(PUBLIC_URL)).rejects.toThrow('URL not allowed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after too many redirects', async () => {
    fetchMock.mockImplementation(async () => redirect(PUBLIC_URL));

    await expect(safeFetch(PUBLIC_URL)).rejects.toThrow('Too many redirects');
  });

  it('reports an error status', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 404 }));

    await expect(safeFetch(PUBLIC_URL)).rejects.toThrow('Feed answered 404');
  });

  it('refuses a body larger than the limit', async () => {
    fetchMock.mockResolvedValue(new Response('x'.repeat(3 * 1024 * 1024)));

    await expect(safeFetch(PUBLIC_URL)).rejects.toThrow('Feed is too large');
  });

  it('reports a timeout', async () => {
    fetchMock.mockRejectedValue(
      new DOMException('The operation timed out', 'TimeoutError'),
    );

    await expect(safeFetch(PUBLIC_URL)).rejects.toThrow('Feed timed out');
  });

  it('only throws WidgetDataError', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(safeFetch(PUBLIC_URL)).rejects.toBeInstanceOf(WidgetDataError);
  });
});
