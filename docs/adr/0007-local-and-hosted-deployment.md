# ADR-0007: One build, local and hosted deployment, local-first data in both

Status: Proposed · Date: 2026-09-24

## Context
The app must run locally (single user) and as a hosted instance. There must be no patient-data
storage, analytics or cloud sync in the MVP. PDF export needs headless Chromium (ADR-0004).

## Decision
- Two containers, `web` (Next.js standalone) and `export-worker` (Node + Playwright), shipped with
  `docker compose` for local use and deployable separately behind a reverse proxy when hosted.
- Projects stay in the visitor's browser (IndexedDB) in **both** modes. The server stores nothing.
- Hosted mode differences are only configuration: the worker is on a private network and reached via
  `/api/export`, with a concurrency cap, queue limit (429 + Retry-After), body limit, timeout,
  no payload logging, and a privacy notice before the first export.
- Local mode falls back to browser print if the worker is down.

## Alternatives
- **Client-only PDF (no worker)**: no data leaves the browser, but a second renderer breaks
  WYSIWYG, or browser print loses control over page size and scaling. Kept as the fallback only.
- **Hosted with accounts + server DB now**: enables cross-device use but adds auth, a GDPR data
  store and backups, all against the MVP privacy constraint. Deferred behind the Repository interface.

## Consequences
+ Same code path locally and hosted; privacy by construction.
− Hosted users lose data if they clear browser storage. The dashboard nudges them to export JSON backups.
− Worker compute is the main hosting cost (~40–70 CPU-seconds per 474-page export).

## Amendment (2026-09-24)
The owner hosts the app on Cloudflare (ADR-0008). The web tier becomes a static export. Server-side
export becomes a per-section HTTP contract with two backends (`export-node` locally, `export-cf` on
Browser Run). Merging and imposition move to the browser.
