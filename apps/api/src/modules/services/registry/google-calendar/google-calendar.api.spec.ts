import { WidgetDataError } from '../errors.js';
import { listEvents } from './google-calendar.api.js';

const TOKEN = 'ya29.secret-token';
const FROM = new Date('2026-10-08T00:00:00Z');

function answer(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe('listEvents', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function calledUrl(): URL {
    return fetchMock.mock.calls[0][0] as URL;
  }

  it('sends the token of the user', async () => {
    fetchMock.mockResolvedValue(answer({ items: [] }));

    await listEvents(TOKEN, { from: FROM, max: 5 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: { Authorization: `Bearer ${TOKEN}` },
      }),
    );
  });

  it('asks for the upcoming events in order', async () => {
    fetchMock.mockResolvedValue(answer({ items: [] }));

    await listEvents(TOKEN, { from: FROM, max: 5 });

    const params = calledUrl().searchParams;
    expect(params.get('timeMin')).toBe('2026-10-08T00:00:00.000Z');
    expect(params.get('timeMax')).toBeNull();
    expect(params.get('singleEvents')).toBe('true');
    expect(params.get('orderBy')).toBe('startTime');
    expect(params.get('maxResults')).toBe('5');
  });

  it('sends the end of the period when there is one', async () => {
    fetchMock.mockResolvedValue(answer({ items: [] }));

    await listEvents(TOKEN, {
      from: FROM,
      to: new Date('2026-10-09T00:00:00Z'),
      max: 5,
    });

    expect(calledUrl().searchParams.get('timeMax')).toBe(
      '2026-10-09T00:00:00.000Z',
    );
  });

  it.each([
    [0, '1'],
    [-3, '1'],
    [200, '50'],
  ])('bounds a max of %d to %s', async (max, expected) => {
    fetchMock.mockResolvedValue(answer({ items: [] }));

    await listEvents(TOKEN, { from: FROM, max });

    expect(calledUrl().searchParams.get('maxResults')).toBe(expected);
  });

  it('translates a timed event', async () => {
    fetchMock.mockResolvedValue(
      answer({
        items: [
          {
            id: 'abc123',
            summary: 'Keynote',
            location: 'Room 1',
            htmlLink: 'https://www.google.com/calendar/event?eid=abc',
            start: { dateTime: '2026-10-09T14:00:00+02:00' },
            end: { dateTime: '2026-10-09T15:00:00+02:00' },
          },
        ],
      }),
    );

    await expect(listEvents(TOKEN, { from: FROM, max: 5 })).resolves.toEqual([
      {
        id: 'abc123',
        title: 'Keynote',
        start: '2026-10-09T14:00:00+02:00',
        end: '2026-10-09T15:00:00+02:00',
        allDay: false,
        location: 'Room 1',
        link: 'https://www.google.com/calendar/event?eid=abc',
      },
    ]);
  });

  it('translates an all-day event without title, place or link', async () => {
    fetchMock.mockResolvedValue(
      answer({
        items: [
          {
            id: 'def456',
            start: { date: '2026-10-12' },
            end: { date: '2026-10-13' },
          },
        ],
      }),
    );

    await expect(listEvents(TOKEN, { from: FROM, max: 5 })).resolves.toEqual([
      {
        id: 'def456',
        title: '(No title)',
        start: '2026-10-12',
        end: '2026-10-13',
        allDay: true,
        location: null,
        link: null,
      },
    ]);
  });

  it('returns no event when Google sends no items', async () => {
    fetchMock.mockResolvedValue(answer({}));

    await expect(listEvents(TOKEN, { from: FROM, max: 5 })).resolves.toEqual(
      [],
    );
  });

  it.each([401, 403, 429, 500])(
    'fails with a readable error on a %d, without the token',
    async (status) => {
      fetchMock.mockResolvedValue(answer({ error: 'nope' }, status));

      const error = await listEvents(TOKEN, { from: FROM, max: 5 }).catch(
        (failure: unknown) => failure,
      );

      expect(error).toBeInstanceOf(WidgetDataError);
      expect((error as Error).message).not.toContain(TOKEN);
    },
  );

  it('asks to link the account without calling Google when there is no token', async () => {
    await expect(listEvents(undefined, { from: FROM, max: 5 })).rejects.toThrow(
      WidgetDataError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
