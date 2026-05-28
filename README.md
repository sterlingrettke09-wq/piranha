# Piranha

Piranha is a regulatory-intelligence tool that helps operators navigate
city permitting and compliance requirements. It pairs a guided wizard
(starting with Boston) with a freeform Q&A interface, both backed by
Claude.

Piranha provides general regulatory information, not legal advice.
Always verify with the relevant city department.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173.

For Netlify functions during local dev (the `/api/*` endpoints), use:

```bash
npx netlify dev
```

## Configuration

Copy `.env.example` to `.env` and fill in the values:

- `ANTHROPIC_API_KEY` — required for the `/api/ask` and `/api/analyze`
  endpoints.
- `MAPBOX_TOKEN` — optional, only needed for map views.

## Deploy

Deployed on Netlify. The `netlify.toml` at the repo root configures the
build (`npm run build` → `dist/`) and the `/api/*` → functions redirect.
Push to the connected branch or run `npx netlify deploy --build` from a
local checkout.

## Stack

- Vite + React 19 + TypeScript
- React Router v6
- Tailwind CSS v4 (CSS-first theme in `src/index.css`)
- Netlify Functions (`netlify/functions/`)

## Credit

Built by [Louisburg Strategies](https://louisburgstrategies.com).
