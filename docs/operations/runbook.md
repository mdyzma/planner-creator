# Runbook: using the planner on your own computer

Everything runs locally: the app in your browser, your planners in the browser's storage, and PDFs
made by your own Google Chrome. Nothing needs Cloudflare or an internet connection after the first
install. (The hosted site is described in [cloudflare.md](cloudflare.md).)

## Once: set up the computer

You need **Node.js 24** (nodejs.org), **Git**, and **Google Chrome** (already installed on this
computer). Then, in PowerShell:

```powershell
corepack enable --install-directory "$env:APPDATA\npm" pnpm   # makes the `pnpm` command available
cd C:\Users\mdyzm\Documents\projects\planner-creator
pnpm install
```

Check it worked: `pnpm --version` prints a version (12.x).

## Every day: start, work, stop

**Start** (one terminal, leave it open):

```powershell
cd C:\Users\mdyzm\Documents\projects\planner-creator
pnpm dev
```

Wait for `Ready` and `Export service on http://127.0.0.1:8787`, then open
**http://localhost:3000** in Chrome. This one command starts both the app and the PDF export
service.

**Work** in the browser:

| To… | Go to |
|---|---|
| Create a planner, import a JSON file | Dashboard (http://localhost:3000) → *New planner* / *Import JSON…* |
| Change pages, blocks, texts, structure | *Design* |
| Check spreads at real size | *Preview* |
| Write or import quotes | *Content* |
| Fill in missing English/Polish texts | *Translations* |
| Make PDFs, calibration sheet, JSON backups | *Export* |

Changes save by themselves (the designer shows "All changes saved").

**Stop**: press **Ctrl+C** in the terminal (answer `Y` if asked). Closing the terminal also stops it.

> **Always use the same address: `http://localhost:3000`.** Planners are stored per browser *and*
> per address. `http://127.0.0.1:3000`, another browser, a private window, or the hosted site each
> have their own, separate, empty storage. To move planners between them, use JSON files (below).

## Printing a month for the ring binder

1. **Export** → *What to print*: pick the month (e.g. *Listopad 2026*). Months always fill whole
   sheets, so each can be filed on its own.
2. *How you print*:
   - A4 on a duplex printer: **Two-sided, automatic**.
   - A4 on a printer without duplex: **Two-sided, by hand** (you get a fronts file and a backs file).
   - A5 planner on normal A4 paper: **A5 on A4 paper (two per sheet)**.
3. **Create PDF**. The file downloads to *Downloads* (e.g. `6-miesieczny-planer-zdrowienia-month-2026-11.pdf`).
4. Print from Chrome or Acrobat with **Actual size / 100 %**, no "fit to page". Two-sided: flip on the
   **long edge** (A4), or the **short edge** for A5-two-per-sheet.
5. A5 two per sheet: cut the whole stack once down the middle (marks at top and bottom), put the
   right-hand pile under the left-hand pile.
6. Punch with a standard **2-hole punch** (80 mm spacing). The binding margin keeps all content
   clear of the holes.

**First time with a printer**, print the **calibration sheet** (Export → *Download calibration
sheet*) on both sides: both rulers must measure exactly 100 mm, and the crosses on the two sides
should line up against the light. For by-hand two-sided printing, it also shows whether the backs
need reverse order (the *Backs in reverse order* option).

## Backups (weekly, and before updating)

Planners live only in this browser. Clearing browsing data for localhost deletes them.

- **Back up**: Export → **Save planner as JSON** (one file per planner; keep them in a folder that
  is backed up, e.g. OneDrive).
- **Restore / move**: Dashboard → **Import JSON…** → pick the file. It is added as a new planner, so
  nothing is overwritten.
- **Share only the layout** (no names or dates): Export → *Save template as JSON*. Importing it
  creates a fresh planner from that template.

## Writing quotes

Short version (details in `templates/therapeutic-recovery/README.md`):

- In the app: **Content** → edit quotes side by side, or *Import CSV* from Excel / Google Sheets,
  then *Re-deal quotes* so every day gets one.
- For the template itself (so every new planner gets them):

  ```powershell
  pnpm --filter @planner/template-therapeutic-recovery quotes:export quotes.csv
  # edit quotes.csv in Excel, save as CSV
  pnpm --filter @planner/template-therapeutic-recovery quotes:import quotes.csv
  ```

## Updating to the latest version

With the app stopped:

```powershell
cd C:\Users\mdyzm\Documents\projects\planner-creator
git pull
pnpm install
pnpm dev
```

Your planners are not touched by updates (they are in the browser, not in the project folder), but
save JSON backups first anyway. If a page looks broken after updating, reload it with **Ctrl+F5**.

## Checking everything works (optional)

```powershell
pnpm check                                          # lint, types, 270+ tests, build (a few minutes)
pnpm --filter @planner/export-node test:e2e         # real PDFs in Chrome: exact A4/A5 sizes, holes clear
```

## Command-line PDF (optional)

For a planner saved as JSON, without opening the app (needs `pnpm --filter @planner/web build` once
after each update):

```powershell
pnpm --filter @planner/export-node pdf C:\path\to\planner.planner.json --section month:2026-11
```

## When something goes wrong

| Problem | Fix |
|---|---|
| `pnpm` is not recognized | Run the `corepack enable …` line from *Once* again, then open a new terminal. |
| `Port 3000 is in use` | The app is already running in another terminal; use that one, or close it. Otherwise find it: `Get-NetTCPConnection -LocalPort 3000` and stop that process. |
| Export says the export service isn't running | You started only the app. Stop it and use `pnpm dev`, or run `pnpm --filter @planner/export-node dev` in a second terminal. Then press *Check again*. |
| `Could not start Chrome` | Install Google Chrome, or point to another Chrome/Chromium: `$env:CHROME_PATH = "C:\path\to\chrome.exe"` before `pnpm dev`. |
| Port 8787 in use | Another export service is still running; close its terminal, or stop the `node` process using port 8787. |
| Dashboard is empty | Wrong address or browser (see the note under *Every day*), or browsing data was cleared: import your latest JSON backups. |
| PDF is slightly too small or large on paper | The print dialog is scaling: choose *Actual size* / 100 %. Check with the calibration sheet. |
| Backs are upside down | Choose the other flip edge in the print dialog (long ↔ short). |
| Something else | Stop (Ctrl+C), `pnpm install`, `pnpm dev` again. If it persists, run `pnpm check` and note the first error. |
