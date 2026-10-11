# Dashboard POC

Proof of concept that the chosen stack works before full development: one
configurable widget that fetches real data from an external API and displays
it.

- **API**: NestJS (`api/`), the same framework as `apps/api`.
- **Web**: Next.js with React (`web/`), the same framework as `apps/web`.
- **Runtime and package manager**: Bun.
- **External API**: [Open-Meteo](https://open-meteo.com), free and without key.

The widget shows the current weather of a city. The user chooses the city and
how often the widget refreshes; the choice is kept in the browser.

## Run it

Requires [Bun](https://bun.sh). Each part installs on its own, the POC is not
part of the `apps/*` workspaces.

```bash
# terminal 1: the API on http://localhost:4000/api
cd poc/api
bun install
bun run start

# terminal 2: the web app on http://localhost:4001
cd poc/web
bun install
bun run dev
```

Open http://localhost:4001, then **Configure** to change the city or the
refresh rate.

The ports differ from the main application (8080 and 8081), so both can run
at the same time. Set `PORT` for the API, and `API_URL` for the web app if the
API runs elsewhere.

## How it works

```
browser ──GET /api/weather?city=Paris──▶ Next.js (4001) ──rewrite──▶ NestJS (4000)
   ▲                                                                    │
   │                                       Open-Meteo geocoding ◀───────┤ city → coordinates
   │                                       Open-Meteo forecast  ◀───────┘ coordinates → weather
   └─────────── { city, country, temperature, windSpeed, weatherCode } ◀┘
```

- `web/src/app/weather-widget.tsx`: the widget. It loads its data, then reloads
  it every `refreshRate` seconds. Saving a new configuration restarts the timer.
  A failed refresh shows the error and keeps the last data.
- `web/next.config.ts`: forwards `/api/*` to the API, so the browser only talks
  to one origin and the API needs no CORS.
- `api/src/weather/`: the controller validates the city, the service calls
  Open-Meteo and returns only the fields the widget displays.

The full application keeps this architecture: widgets are declared in the API
registry, the web app calls `GET /api/widgets/:id/data`, and only the API talks
to external services.

## Try the API alone

```bash
curl "http://localhost:4000/api/weather?city=Lyon"
curl "http://localhost:4000/api/weather?city=Xyzzyqq"   # 404, unknown city
curl "http://localhost:4000/api/weather"                # 400, no city
```
