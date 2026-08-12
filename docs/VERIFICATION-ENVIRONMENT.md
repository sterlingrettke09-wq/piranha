# What a green run means

Three environments run this code: **vitest** (the suite), the **isolation
worktree** (`scripts/verify.sh`-style patch verification), and **Netlify**
(production). They differ, and a pass is scoped to what the environment
withheld.

This file exists because that scoping was invisible. The isolation worktree ran
without `.env` for a week; every check was green, and each was verifying a subset
of behaviour nobody could name. Linking `.env` closed the instance. This closes
the class by writing down what each environment provides — so "it passed" has a
stated meaning rather than an assumed one.

**Keep this current when you change the harness or add an environment
dependency.** A row that goes stale here is the same defect the file was written
to prevent.

---

## 1. What the isolation worktree provides

`git worktree add --detach <base>` + `git apply <patch>`, then `tsc -b`,
`vitest run`, `eslint .`.

| Provided | How |
|---|---|
| Repo at `<base>` + the patch | `checkout --force`, `clean -qfdx -e node_modules`, `git apply` |
| `node_modules` | symlink to the main checkout |
| `.env` | symlink to the main checkout — **added 2026-08-12, absent before** |
| Shell environment | inherited from the parent process |
| Node | whatever `npx` resolves; **not pinned to `netlify.toml`'s `NODE_VERSION = 20.20.0`** |

**Withheld:** anything `git clean -qfdx` removes that is not `node_modules` —
build output, caches, untracked local files. That is deliberate; it is what makes
the check an isolation check.

**The base is pinned and asserted.** `verify.sh` resolves the SHA in the main
repo, then asserts the worktree's `HEAD` equals it (exit 16). This exists because
`HEAD` inside a worktree resolves to the *worktree's* detached head — a run once
verified against a stale base and reported green.

**Every step's exit code is checked** (9–16). A `checkout` that aborts on local
changes once left `clean`/`apply` operating on a stale tree, which produced a
green result for code that was never applied.

---

## 2. What vitest withholds — the important section

**All 29 provider test files mock `fetch`.** No test in the suite makes a real
upstream call. Everything below follows from that.

### Timeouts are not exercised

| | value | enforced by |
|---|---|---|
| Netlify synchronous function wall | 10 s | the platform, at runtime |
| `REQUIRED_BUDGET_MS` | 7 s | `requiredUpstream.ts`, at runtime |
| vitest per-test timeout | 5 s (default; **not configured**) | vitest |

The vitest limit is a **test** timeout, not a **request** timeout, and with fetch
mocked every call returns instantly. So no test has ever run against the 10 s
wall or the 7 s budget in the way production applies them.

`requiredUpstream.test.ts` asserts the budget *arithmetically* —
`requestDeadline()` returns `now + REQUIRED_BUDGET_MS` — which proves the
constant is wired, not that a real request finishes inside it. Attempt caps are
asserted by recording the timeout values handed to a stubbed attempt
(`expect(seen).toEqual([3000, 3000])`), again without time passing.

**Consequence, stated plainly:** every timing conclusion this project has drawn
came from live probing outside the suite — the Phoenix 8.7 s p90, the 14 s
arithmetic reachability, the 9.2 s ceiling, the front-door latency table. Those
are the real measurements. **A green suite says nothing about whether a request
fits in the wall**, and should never be cited as if it did.

### Also withheld by vitest

- **Upstream behaviour**: outage, throttling, partial responses, a 200 carrying
  an error body, TLS or DNS failure. Mocks return what they were told to.
- **Concurrency**: no test exercises several requests in flight, so nothing
  observes contention, rate limits, or shared-deadline interaction under load.
- **The CDN**: cache headers are asserted as strings; no test observes a cached
  response being served, or `ESTIMATES_VERSION` busting a real cache.
- **The browser**: JSDOM, not a renderer. Layout, overflow and animation are not
  measured (the count-up components need `prefers-reduced-motion` forced to
  render at rest in a headless pane).

---

## 3. What Netlify provides that neither test environment has

- **The 10 s wall** on synchronous functions. `netlify.toml` has **no
  `[functions]` block**, so the platform default applies and the number is not
  stated anywhere in the repo. The 7 s budget was chosen against it.
- **`NODE_VERSION = 20.20.0`**, pinned in `netlify.toml` and not enforced
  locally.
- **Environment variables**, per deploy context. `ADMIN_KEY` is set on
  **production only** — there is no `dev` value, so `.env` holds a different,
  unmanaged one and `/admin` behaves differently in the two places.
- **Netlify Blobs**, backing the search log. `searchLog.ts` falls back to a
  temp-directory implementation when the Blobs environment is absent, so local
  runs exercise the fallback, never the real store.
- **The edge function** (`og.ts`), which rewrites `<title>`/meta by
  string-matching `index.html`. It runs at the edge and is not in the vitest path
  by default.
- **Real client IPs**, which the rate limiter keys on (20/min). Locally every
  request looks like one client — a probe loop must vary `x-forwarded-for` or it
  measures the limiter.

### Variables the code reads

`ADMIN_KEY` · `GEMINI_API_KEY` · `MAPBOX_TOKEN` · `NETLIFY_BLOBS_SITE_ID` ·
`NETLIFY_BLOBS_TOKEN` · `VITE_MAPBOX_TOKEN`

`MAPBOX_TOKEN` (server) and `VITE_MAPBOX_TOKEN` (client) are different keys. The
front-door measurement used the client key, which *is* what the search widget
uses in production — but nothing has tested the server key.

---

## 4. So what does a green run mean

**A green suite means:** the code compiles, the units behave as their fixtures
describe, and the guards that compare claims to artifacts agree.

**It does not mean:** a request fits in the wall, an upstream behaves, a cache
works, a page lays out, or a published number is true. Every defect this project
has found was invisible to it (rule 9).

**A green isolation run means** the above **plus** that the change stands alone
at its parent — no dependency on a later commit — under the environment in §1.
Nothing more.

**Not yet closed:** Node is unpinned in the harness; no environment enforces the
10 s wall outside production; the server-side `MAPBOX_TOKEN` path is untested;
the Blobs store is only ever exercised through its fallback locally.
