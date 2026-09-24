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
