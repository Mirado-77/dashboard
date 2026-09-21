# Dashboard

## Lancer avec Docker

```sh
cp .env.example .env   # remplir AUTH_SECRET et les clés OAuth si besoin
docker compose up --build
```

- Web : http://localhost:8081
- API : http://localhost:8080
- Mailpit (emails) : http://localhost:8025

## Lancer en dev (sans Docker pour l'API et le web)

```sh
bun install
docker compose up -d db mailpit
bun run dev:api
bun run dev:web
```
