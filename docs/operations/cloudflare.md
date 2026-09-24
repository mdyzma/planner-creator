# Cloudflare deployment

How the app gets from `main` to Cloudflare (design: [§10.4–10.6](../architecture/system-design.md),
[ADR-0008](../adr/0008-cloudflare-hosting-and-ci-cd.md)).

## What runs where

One Worker, `planner-creator` (`apps/worker`), serves everything from one origin:

| Path | Handled by | Notes |
|---|---|---|
| Everything else (`/`, `/en/editor`, `/_next/…`) | Workers Static Assets (`apps/web/out`) | No Worker code runs; free and unlimited. Security headers come from `apps/web/public/_headers`. |
| `/api/export/health` | Worker | `{ ok: true }` when Browser Run is available |
| `/api/export/pdf` | Worker + **Browser Run** | Renders one part of a planner to PDF. Same-origin requests only, 20 per minute per IP, 10 MB limit, nothing stored or logged. |

Until a domain is chosen, the app is served at `https://planner-creator.<your-subdomain>.workers.dev`.

## One-time setup (owner)

1. **Cloudflare account**: sign up at dash.cloudflare.com. The Workers **Free** plan works:
   Browser Run is included with 10 browser-minutes a day and 3 browsers at once, which is enough
   for a few full planners a day (one six-month planner takes about 1–2 browser-minutes).
   Workers **Paid** ($5/month) raises that to 10 hours a month and 10 browsers.
2. **workers.dev subdomain**: Workers & Pages → pick your `*.workers.dev` subdomain.
3. **API token**: My Profile → API Tokens → Create Token → template **"Edit Cloudflare Workers"**.
   Limit *Account Resources* to your account. When you add a domain, also allow *Zone Resources*
   for that zone. Copy the token; it is shown once.
4. **Account ID**: Workers & Pages overview, right-hand side.
5. **GitHub secrets**: repository → Settings → Secrets and variables → Actions → *New repository secret*:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
6. **GitHub variable** (same page, *Variables* tab): `PRODUCTION_URL` = the deployed address, e.g.
   `https://planner-creator.<your-subdomain>.workers.dev`. It turns on the weekly drift check.
7. *(Optional)* Settings → Environments → `production` → add yourself as a required reviewer if you
   want a manual approval before each deploy.

Until the secrets exist, the `Deploy` workflow still runs all checks and skips the deploy step
with a notice. The first deploy after adding them creates the Worker.

## Pipeline

```text
push to a branch / PR   → ci.yml:     lint · format · typecheck · test · build
                                      · Worker bundle (wrangler deploy --dry-run)
                                      · PDF export in Chrome (exact page sizes, ring holes clear)
                                      · upload site artefact
push to main            → deploy.yml: ci.yml (same checks) → wrangler deploy of the tested artefact
                                      → smoke test: site loads, /api/export/health ok,
                                        Content-Security-Policy present
                                      → wrangler rollback if the smoke test fails
Mondays 05:17 UTC       → drift.yml:  the same pages rendered by Browser Run and by a local Chrome
                                      must match (under 1 % of pixels differ per page)
```

## Domain (when chosen)

1. **Buy** it in Cloudflare: Domain Registration → Register Domains (at-cost pricing; `.pl` is not
   sold there, so a `.pl` domain is bought elsewhere and added as a site with Cloudflare DNS).
2. **Attach** it to the Worker: in `apps/worker/wrangler.jsonc` uncomment `routes` and set the name:

   ```jsonc
   "routes": [{ "pattern": "planner.example.com", "custom_domain": true }],
   ```

   Commit to `main`; the deploy creates the DNS record and certificate. Allow the API token
   *Zone → DNS → Edit* and *Workers Routes → Edit* for that zone first.
3. **Update** the GitHub variable `PRODUCTION_URL` to the new address.
4. *(Optional)* Set `"workers_dev": false` once the domain works, so only one address serves the app.

## Security settings (with a domain)

The Worker already limits PDF requests per IP and only accepts them from the site's own pages.
On the domain's zone, also:

- **WAF → Rate limiting rules** (one rule is free): *URI Path starts with `/api/export/`*,
  more than 60 requests per 10 seconds per IP → **Block** for 10 seconds.
- **Security → Bots**: turn on *Bot Fight Mode*.
- **SSL/TLS**: *Full (strict)*, *Always Use HTTPS* on, minimum TLS 1.2.
- Leave **Web Analytics**, **Zaraz** and **Browser Insights** off: the privacy notice promises no
  analytics (§10.2).

## Manual commands

```bash
pnpm --filter @planner/web build              # static export to apps/web/out
pnpm --filter @planner/worker check:bundle    # bundle the Worker without deploying
pnpm --filter @planner/worker exec wrangler login
pnpm --filter @planner/worker deploy          # deploy from your machine
pnpm --filter @planner/worker exec wrangler rollback
pnpm --filter @planner/worker exec wrangler tail   # live errors (never contains planners)
```

`pnpm --filter @planner/worker preview` runs the Worker locally (`wrangler dev`). Its Browser Run
binding is emulated with a local Chrome that wrangler **downloads on the first PDF request
(about 330 MB)**; use `wrangler dev --remote` to use the real Browser Run instead, or develop with
`pnpm dev` and the local export service (apps/export-node).

## Privacy settings to keep

- Web Analytics / Zaraz: **off** (the product has no analytics, §10.2).
- Workers Logs: on (errors only are written). The Worker never logs request bodies; keep it that way.
- The privacy notice at `/en/privacy` and `/pl/privacy` describes exactly this setup; update it when
  anything here changes.
