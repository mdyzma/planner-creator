# ADR-0008: Host on Cloudflare (static assets + Browser Run export Worker), GitHub Actions CI/CD

Status: Proposed · Date: 2026-09-24

## Context
The project owner runs the hosted instance. They want a local dev server, automated deployment, and
one place to buy and maintain the domain. The app is client-only except for PDF rendering, which
needs headless Chromium (ADR-0004). The code is on GitHub.

## Decision
- **Web:** Next.js static export served from **Workers Static Assets**.
- **Export:** a Worker (`apps/export-cf`) using the **Browser Run** binding (`@cloudflare/puppeteer`)
  implements `POST /api/export/section`. It renders one section per request. The browser merges
  sections and applies imposition with `pdf-lib`.
- **Local dev / CI:** `apps/export-node` (Node + Playwright) implements the same contract.
- **Domain:** Cloudflare Registrar + DNS when the TLD is supported. Otherwise buy the domain
  elsewhere and delegate nameservers to Cloudflare.
- **CI/CD:** GitHub Actions. PRs get checks and a preview deploy; `main` gets a gated production
  deploy with a smoke test and `wrangler rollback`; a nightly job diffs Browser Run output against
  local Playwright output.
- Workers Paid plan ($5/month) for production. The Free plan (10 browser-minutes/day) is enough
  for previews.

## Alternatives
- **Vercel (web) + Fly.io/Railway (Playwright container):** mature Next.js hosting, but two vendors
  plus a separate registrar, and an always-on container to pay for.
- **Single VPS (Hetzner) + Docker Compose + Caddy:** cheapest and fully controlled, but OS patching,
  TLS, backups and uptime are on the owner.
- **Cloudflare Containers running `export-node`:** identical output to local Playwright. Kept as the
  escape hatch if Browser Run output drifts or its limits get in the way.

## Consequences
+ One vendor for domain, DNS, TLS, CDN, WAF and compute; no servers to patch; pay-per-use export.
+ The same client code works against local and hosted export.
− Two export backends to keep equivalent. Mitigated by one shared contract and a nightly visual diff.
− Browser Run limits (60 s idle timeout, extendable to 10 min; per-plan concurrency) shape the design
  into per-section rendering. Re-check the limits before launch.
− Vendor coupling is limited to `apps/export-cf` and `wrangler.jsonc`; the web build is a portable static site.

## Amendment (2026-09-25, M8 as built)
- **One Worker, one origin.** `apps/worker` (worker name `planner-creator`) serves the static build
  through Workers Static Assets and runs code only for `/api/*` (`run_worker_first`). The export
  endpoint is `POST /api/export/pdf` with the same contract as `apps/export-node`; the request
  validation is shared (`@planner/pdf/request`). Same origin means no CORS: the Worker refuses
  requests whose `Origin` is not the site itself.
- **Browser sessions are reused** (`puppeteer.sessions` / `connect`, `keep_alive` 60 s), so the
  eight parts of a planner usually share one browser instead of launching eight.
- **Abuse limits:** Workers rate limiting binding (20 requests per minute per IP), 10 MB body limit,
  and a zone WAF rule once a domain exists (docs/operations/cloudflare.md).
- **Security headers** (CSP, nosniff, no-referrer, permissions, COOP, HSTS) come from a `_headers`
  file in the static build. Next.js' static export needs `'unsafe-inline'` scripts; Zod runs in
  jitless mode so no `eval` is needed anywhere.
- **Free plan first.** Browser Run on Workers Free (10 browser-minutes a day) is enough to start;
  switch to Paid if exports hit the limit.
- **Preview deploys per PR** are not set up (solo workflow). The drift check runs weekly rather than
  nightly, to spend fewer browser-minutes.
