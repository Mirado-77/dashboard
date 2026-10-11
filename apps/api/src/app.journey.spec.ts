import { PGlite } from '@electric-sql/pglite';
import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import request from 'supertest';
import { DATABASE } from './database/database.module.js';
import * as schema from './database/schema/index.js';
import { MailService, type MailMessage } from './modules/mail/mail.service.js';

/**
 * The whole path of a new user, from signing up to a widget showing data.
 *
 * The real application runs here: controllers, guard, auth and services. Only
 * what leaves the process is replaced: Postgres by an embedded one, the SMTP
 * server by an inbox, and the third-party API by a canned answer.
 */

const WEB_URL = 'http://localhost:8081';

const rick = {
  name: 'Rick',
  email: 'rick@journey.test',
  password: 'wubbalubba',
};
const morty = {
  name: 'Morty',
  email: 'morty@journey.test',
  password: 'aw-geez-rick',
};

const paris = {
  name: 'Paris',
  country: 'France',
  latitude: 48.85,
  longitude: 2.35,
};

let app: INestApplication;
let database: PGlite;
const inbox: MailMessage[] = [];
const thirdPartyCalls: string[] = [];

/** Open-Meteo, the only third party this journey reaches. */
async function fakeFetch(input: string | URL | Request): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : input);
  thirdPartyCalls.push(url.hostname);

  if (url.hostname === 'geocoding-api.open-meteo.com') {
    const known = url.searchParams.get('name')?.toLowerCase() === 'paris';
    return Response.json(known ? { results: [paris] } : {});
  }
  if (url.hostname === 'api.open-meteo.com') {
    return Response.json({
      current: {
        time: '2026-10-11T12:00',
        temperature_2m: 18.4,
        weather_code: 3,
        wind_speed_10m: 12.1,
      },
      daily: {
        time: [],
        temperature_2m_max: [],
        temperature_2m_min: [],
        weather_code: [],
      },
    });
  }
  throw new Error(`Unexpected call to ${url.hostname}`);
}

/** The link of the last mail sent to this address, as a path of the API. */
function linkSentTo(email: string): string {
  const mail = inbox.findLast((message) => message.to === email);
  const url = mail?.text.match(/https?:\/\/\S+/)?.[0];
  if (!url) throw new Error(`No link was sent to ${email}`);
  const { pathname, search } = new URL(url);
  return pathname + search;
}

function server() {
  return app.getHttpServer();
}

/** A browser: it keeps its cookies, and sends the origin of the web app. */
function browser() {
  const agent = request.agent(server());
  agent.set('origin', WEB_URL);
  return agent;
}

async function signUpAndVerify(user: typeof rick) {
  await browser().post('/api/auth/sign-up/email').send(user).expect(200);
  await request(server()).get(linkSentTo(user.email)).expect(200);
}

beforeAll(async () => {
  // Read by the configuration when the application module is imported.
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('DATABASE_URL', 'postgres://unused:unused@localhost:5432/unused');
  vi.stubEnv('AUTH_SECRET', 'journey-secret-journey-secret-journey');
  vi.stubEnv('WEB_URL', WEB_URL);
  vi.stubEnv('ADMIN_EMAILS', '');
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
  Logger.overrideLogger(false);

  database = new PGlite();
  const db = drizzle(database, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });

  const { AppModule } = await import('./app.module.js');
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DATABASE)
    .useValue(db)
    .overrideProvider(MailService)
    .useValue({
      send: async (message: MailMessage) => {
        inbox.push(message);
      },
    })
    .compile();

  app = module.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await database?.close();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('from signing up to the dashboard', () => {
  const rickBrowser = () => (rickAgent ??= browser());
  let rickAgent: ReturnType<typeof browser> | undefined;
  let widgetId: string;

  it('keeps the dashboard closed to a visitor', async () => {
    await request(server()).get('/api/widgets').expect(401);
    await request(server()).get('/api/services').expect(401);
  });

  it('signs up without opening a session, and sends a confirmation mail', async () => {
    const response = await rickBrowser()
      .post('/api/auth/sign-up/email')
      .send(rick)
      .expect(200);

    expect(response.body.user).toMatchObject({
      email: rick.email,
      emailVerified: false,
    });
    expect(JSON.stringify(response.body)).not.toContain(rick.password);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(inbox.filter((mail) => mail.to === rick.email)).toHaveLength(1);
    await rickBrowser().get('/api/widgets').expect(401);
  });

  it('refuses the sign in until the email is confirmed', async () => {
    const response = await rickBrowser()
      .post('/api/auth/sign-in/email')
      .send({ email: rick.email, password: rick.password })
      .expect(403);

    expect(response.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('confirms the email with the link of the mail, once', async () => {
    const link = linkSentTo(rick.email);

    await request(server()).get(link).expect(200);
    await request(server()).get(link).expect(400);
  });

  it('refuses a wrong password', async () => {
    await rickBrowser()
      .post('/api/auth/sign-in/email')
      .send({ email: rick.email, password: 'not-the-password' })
      .expect(401);
    await rickBrowser().get('/api/widgets').expect(401);
  });

  it('signs in and opens a session', async () => {
    await rickBrowser()
      .post('/api/auth/sign-in/email')
      .send({ email: rick.email, password: rick.password })
      .expect(200);

    const session = await rickBrowser()
      .get('/api/auth/get-session')
      .expect(200);
    expect(session.body.user).toMatchObject({
      name: rick.name,
      email: rick.email,
      emailVerified: true,
      role: 'user',
    });
  });

  it('starts with an empty dashboard', async () => {
    const response = await rickBrowser().get('/api/widgets').expect(200);

    expect(response.body).toEqual([]);
  });

  it('offers the services, none of them subscribed', async () => {
    const response = await rickBrowser().get('/api/services').expect(200);

    const weather = response.body.find(
      (service: { id: string }) => service.id === 'weather',
    );
    expect(
      weather.widgets.map((widget: { id: string }) => widget.id),
    ).toContain('city_temperature');
    expect(
      response.body.every(
        (service: { subscribed: boolean }) => !service.subscribed,
      ),
    ).toBe(true);
  });

  it('needs no subscription for a service without account', async () => {
    const response = await rickBrowser()
      .post('/api/services/weather/subscribe')
      .send({})
      .expect(400);

    expect(response.body.code).toBe('NO_SUBSCRIPTION_NEEDED');
  });

  it('asks to link the account before subscribing to its service', async () => {
    const response = await rickBrowser()
      .post('/api/services/github/subscribe')
      .send({})
      .expect(400);

    expect(response.body.code).toBe('PROVIDER_NOT_LINKED');
  });

  it('refuses a widget of a service that is not subscribed', async () => {
    const response = await rickBrowser()
      .post('/api/widgets')
      .send({
        serviceId: 'github',
        widgetId: 'last_commits',
        config: { repo: 'nestjs/nest' },
      })
      .expect(400);

    expect(response.body.code).toBe('NOT_SUBSCRIBED');
  });

  it('refuses a widget with a configuration it does not expect', async () => {
    const response = await rickBrowser()
      .post('/api/widgets')
      .send({ serviceId: 'weather', widgetId: 'city_temperature', config: {} })
      .expect(400);

    expect(response.body.code).toBe('INVALID_WIDGET_CONFIG');
  });

  it('adds a widget to the dashboard', async () => {
    const response = await rickBrowser()
      .post('/api/widgets')
      .send({
        serviceId: 'weather',
        widgetId: 'city_temperature',
        config: { city: 'Paris' },
      })
      .expect(201);

    expect(response.body).toMatchObject({
      serviceId: 'weather',
      widgetId: 'city_temperature',
      config: { city: 'Paris' },
      refreshRate: 600,
      position: 0,
    });
    widgetId = response.body.id;

    const dashboard = await rickBrowser().get('/api/widgets').expect(200);
    expect(dashboard.body.map((widget: { id: string }) => widget.id)).toEqual([
      widgetId,
    ]);
  });

  it('shows the data of the widget, fetched by the API', async () => {
    const response = await rickBrowser()
      .get(`/api/widgets/${widgetId}/data`)
      .expect(200);

    expect(response.body).toEqual({
      data: {
        city: 'Paris',
        country: 'France',
        temperature: 18.4,
        windSpeed: 12.1,
        weatherCode: 3,
      },
    });
    expect(thirdPartyCalls).toEqual([
      'geocoding-api.open-meteo.com',
      'api.open-meteo.com',
    ]);
  });

  it('serves the next refresh from the cache', async () => {
    await rickBrowser().get(`/api/widgets/${widgetId}/data`).expect(200);

    expect(thirdPartyCalls).toHaveLength(2);
  });

  it('reconfigures the widget', async () => {
    const response = await rickBrowser()
      .patch(`/api/widgets/${widgetId}`)
      .send({ refreshRate: 120 })
      .expect(200);

    expect(response.body).toMatchObject({
      config: { city: 'Paris' },
      refreshRate: 120,
    });
  });

  it('keeps the dashboard of a user out of reach of another one', async () => {
    await signUpAndVerify(morty);
    const mortyBrowser = browser();
    await mortyBrowser
      .post('/api/auth/sign-in/email')
      .send({ email: morty.email, password: morty.password })
      .expect(200);

    expect((await mortyBrowser.get('/api/widgets').expect(200)).body).toEqual(
      [],
    );
    await mortyBrowser.get(`/api/widgets/${widgetId}/data`).expect(404);
    await mortyBrowser
      .patch(`/api/widgets/${widgetId}`)
      .send({ refreshRate: 900 })
      .expect(404);
    await mortyBrowser.delete(`/api/widgets/${widgetId}`).expect(404);
    expect(
      (await rickBrowser().get('/api/widgets').expect(200)).body,
    ).toHaveLength(1);
  });

  it('removes the widget from the dashboard', async () => {
    await rickBrowser().delete(`/api/widgets/${widgetId}`).expect(200);

    expect((await rickBrowser().get('/api/widgets').expect(200)).body).toEqual(
      [],
    );
    await rickBrowser().get(`/api/widgets/${widgetId}/data`).expect(404);
  });

  it('closes the dashboard again after signing out', async () => {
    await rickBrowser().post('/api/auth/sign-out').expect(200);

    await rickBrowser().get('/api/widgets').expect(401);
  });
});
