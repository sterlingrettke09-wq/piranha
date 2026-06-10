# Piranha

Piranha (The Piranha Project) is a regulatory-intelligence tool that helps
operators navigate city permitting and compliance requirements. It pairs a
parcel-level feasibility wizard (ten US cities, live zoning/parcel data from
each city's public GIS services) with a freeform Q&A assistant.

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

- `VITE_MAPBOX_TOKEN` — **required** for the map, parcel mini-map, and address
  search. This is a *public* token inlined into the client bundle at build
  time, so use a `pk.` token and **restrict it by URL** (your production
  domain) in the Mapbox dashboard.
- `MAPBOX_TOKEN` — optional, server-side only. Used by the reverse geocoder in
  the Netlify functions. If unset, the functions fall back to
  `VITE_MAPBOX_TOKEN`; setting a separate secret token here lets you keep the
  public one tightly referrer-locked.
- `GEMINI_API_KEY` — optional. Enables the `/api/ask` assistant (Google
  Gemini, `gemini-2.5-flash-lite`). Without it the assistant reports "not
  available yet" and everything else works. Set a billing alert on this key —
  the in-process rate limiter is best-effort, not a durable spend cap.
- `ADMIN_KEY` — optional. Passphrase for the owner-only `/admin` search log.
- `NETLIFY_BLOBS_SITE_ID` / `NETLIFY_BLOBS_TOKEN` — optional. Only needed if
  the deploy doesn't auto-inject the Netlify Blobs environment (the search log
  store); see `netlify/functions/lib/searchLog.ts`.

The `/api/analyze` feasibility engine is fully deterministic — it calls city
GIS services and Mapbox, not an LLM, and needs no model API key.

## Deploy

Deployed on Netlify. The `netlify.toml` at the repo root configures the build
(`npm run build` → `dist/`), the `/api/*` → functions redirect, security
headers (CSP — extend it if you add a new third-party script or API), and the
`og` edge function that injects per-route titles, social cards, and canonical
URLs. Push to the connected branch or run `npx netlify deploy --build` from a
local checkout.

## Stack

- Vite + React 19 + TypeScript
- React Router v7
- Tailwind CSS v4 (CSS-first theme in `src/index.css`)
- Netlify Functions (`netlify/functions/`) + one Edge Function
  (`netlify/edge-functions/og.ts`)
- Vitest (`npm test`)

## Credit

Built by [Louisburg Strategies](https://louisburgstrategies.com).
