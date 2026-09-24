# Export service (local)

Turns planners into print-ready PDFs by loading the web app's print route in headless Google
Chrome (design §8.3, ADR-0004). It uses the Chrome already installed on the computer through
`playwright-core`, so nothing else is downloaded.

## In the app

1. `pnpm dev` at the repository root starts the app and this service together; the service then
   renders from the dev server. To render from a production build instead:

   ```bash
   pnpm --filter @planner/web build
   pnpm --filter @planner/export-node serve
   ```

2. Open a planner's **Export** screen and press **Create PDF**. The app sends one section at a
   time to the service, then merges the parts and arranges them for the chosen print option
   (two-sided, by hand, A5 two per A4 sheet) in the browser.

The service listens on `127.0.0.1:8787` only, accepts requests from the origins in
`EXPORT_ALLOWED_ORIGINS`, and keeps nothing: the planner is injected into the page and the PDF is
returned directly.

| Variable | Default | Meaning |
|---|---|---|
| `EXPORT_PORT` | `8787` | Port on 127.0.0.1 |
| `EXPORT_ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated web app origins |
| `EXPORT_WEB_URL` | — | Render from a running web app (e.g. the dev server) instead of `apps/web/out` |
| `CHROME_PATH` | Google Chrome | Another Chrome or Chromium |

During development (`pnpm dev`) the web app uses this service at `http://127.0.0.1:8787`; the
deployed site uses its own Worker (apps/worker) instead. `NEXT_PUBLIC_EXPORT_URL` overrides both.

## From the command line

Save a planner as JSON on the Export screen, then:

```bash
pnpm --filter @planner/export-node pdf path/to/planner.planner.json --profile home-a5-2up --section month:2026-11
```

## Tests

- `pnpm --filter @planner/export-node test`: the HTTP service with a stand-in renderer.
- `pnpm --filter @planner/export-node test:e2e`: real PDFs from Chrome (needs the web build).
  Checks that A4 pages are exactly 595.28 × 841.89 pt and A5 pages 419.53 × 595.28 pt, that 2-up
  sheets are A4 landscape, and that no block reaches into the punched-hole zone. CI runs it.

Chrome rounds PDF paper sizes to its own units (A4 comes out as 594.96 × 841.92 pt). The merge
step sets every page's box back to the exact size, anchored at the top left where the content
is laid out in real millimetres.
