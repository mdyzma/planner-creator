# Cloudflare deployment

How the app gets from `main` to Cloudflare (design: [§10.4–10.6](../architecture/system-design.md),
[ADR-0008](../adr/0008-cloudflare-hosting-and-ci-cd.md)).

## What runs where

| Piece | Where | Status |
|---|---|---|
| Static web app (`apps/web/out`) | Cloudflare Workers Static Assets, worker `planner-creator` | M0 |
| PDF export Worker (Browser Run) | Worker `planner-export` | M8 |
| Domain + DNS | Cloudflare Registrar / DNS | M8 (domain not chosen yet) |

Until a domain is chosen, the app is served at `https://planner-creator.<your-subdomain>.workers.dev`.

## One-time setup (owner)

1. **Cloudflare account**: sign up at dash.cloudflare.com. The Workers Free plan is enough for M0.
   Switch to Workers Paid ($5/month) before M8 (PDF export).
2. **workers.dev subdomain**: Workers & Pages → pick your `*.workers.dev` subdomain.
3. **API token**: My Profile → API Tokens → Create Token → template **"Edit Cloudflare Workers"**.
   Limit *Account Resources* to your account and *Zone Resources* to "All zones" (or none for now).
   Copy the token; it is shown once.
4. **Account ID**: Workers & Pages overview, right-hand side.
5. **GitHub secrets**: repository → Settings → Secrets and variables → Actions → *New repository secret*:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
6. *(Optional)* Settings → Environments → `production` → add yourself as a required reviewer if you
   want a manual approval before each deploy.

Until the secrets exist, the `Deploy` workflow still runs all checks and skips the deploy step
with a notice.

## Pipeline

```text
push to a branch / PR   → ci.yml:     lint · format · typecheck · test · build · upload site artefact
push to main            → deploy.yml: ci.yml (same checks) → wrangler deploy of the tested artefact
                                      → smoke test (page contains "Planner Designer")
                                      → wrangler rollback if the smoke test fails
```

## Manual commands

```bash
pnpm --filter @planner/web build          # static export to apps/web/out
pnpm --filter @planner/web preview        # serve out/ locally through wrangler (workerd)
pnpm --filter @planner/web exec wrangler login
pnpm --filter @planner/web deploy         # deploy from your machine
pnpm --filter @planner/web exec wrangler rollback   # roll back to the previous version
```

## Privacy settings to keep

- Web Analytics / Zaraz: **off** (the product has no analytics, §10.2).
- Workers Logs: on for errors only. The M8 export Worker must never log request bodies.
