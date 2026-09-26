# Roadmap

Where "Dzień po Dniu" stands after v0.8.0, measured against the two content reviews,
[improvement-session-1.md](improvement-session-1.md) (S1) and
[planner-improvement-session-2.md](planner-improvement-session-2.md) (S2, the "version 2.0"
content specification), and what comes next. Releases bundle several steps; a tag and release
only when a set of steps is complete.

Last updated: 2026-09-26, after v0.8.0 (online at https://planner.example.com).

## Done (v0.1.0 – v0.2.0)

| Proposal | Where |
| --- | --- |
| YAPCO as the platform, "Dzień po Dniu" as the planner | v0.1.0 |
| Separate craving scale 0–10, with the time (S1, S2) | Evening check-out |
| HALT-B (S1 §1, S2) | Day page; HALT / HALT-B chosen in the designer |
| Plan of the day 06–22, configurable, 30/60 min (S2) | Day page, designer |
| Triggers as tick boxes, "Co zrobiłem?" (S1 §4, S2) | Evening page |
| "Co mnie dziś chroniło?" daily (S1 §8, S2) | Evening page |
| "Małe zwycięstwo", "Dobre życie" (S1 §9, §13, S2) | Evening page |
| Risky thought and mini-ABC, optional (S1 §3, §5, S2) | "Analiza sytuacji", weekly, off by default |
| Weekly pattern review (S1 §15, S2 III) | "Mój tydzień" at the end of each week |
| If–then plans (S1 §2) | Weekly: from the review to the start-of-week column |

## Deliberate differences

Compatible with the intent of the reviews; keep unless there is a reason to change.

- **Week review placement.** S2 puts it on the right-hand weekly page; it is a separate page at the
  end of the week, so it is filled in when the week is over, without turning back 14 pages.
- **Trigger list without loneliness, boredom and tiredness.** They are HALT-B rows already.
- **All scales 0–10.** S2 has mood 1–10; one scale means "0" always reads "not at all".
- **Mini-ABC weekly, not daily.** S1 itself advises against the full ABC every day.
- **HALT note column "Powód:"** instead of S2's "Czego teraz potrzebuję?"; both can coexist
  (phase 1).
- **Word of the month on the divider page**, not on the month opening; "Dalej" asks for next
  month's word.
- **"Ważne terminy" as a writing area**, not tick boxes: dates have to be written anyway.
- **Sleep quality 1–5**, the one exception to 0–10, kept by choice.

## Still open

From the content reviews:

- **More modules (S2 XII):** Mindfulness and Productivity.

Loose ends:

- Size: six months are about 554 pages; acceptable, since months print and file one at a time.

## Next

### 1.0

- **Before 1.0:** ideally a review of the recovery content by a therapist (requested, awaiting
  a response). Done (2026-09-26): a real print test of one month (it works well), a
  proofreading pass of the English texts (planner, quotes and interface), and the production
  deployment (v0.8.0, below).
- The handwriting preview is dropped unless needed; the example filling covers most of it.
- Hosting on Cloudflare Workers stays possible (route A in
  [operations/deploy-subdomain.md](operations/deploy-subdomain.md)); the site runs self-hosted.

### Optional, any time

- A second, non-therapeutic template (e.g. a simple weekly planner), to prove the engine is
  generic, as the original brief intended.
- Mindfulness and Productivity modules.

### Decisions for v0.7.0

1. Day page: the optional "Dzień+" module; every planner gets "Z kim dziś porozmawiam?" and
   "Czego teraz potrzebuję?".
2. The therapeutic contract replaces "Moja umowa ze sobą" in the Recovery Edition.
3. Order: the roadmap's order (content, then quality, then print and publish).

## Released

### v0.8.0 — Online

Released 2026-09-26:

- Online at https://planner.example.com: self-hosted in a Proxmox container (Caddy, the PDF
  service with Chromium) behind a Cloudflare Tunnel. GitHub is mirrored to Gitea; Jenkins runs
  the same checks as GitHub CI and deploys the tested commit over SSH with
  `deploy/proxmox/install.sh` ([operations/deploy-subdomain.md](operations/deploy-subdomain.md),
  route B).
- A more app-like designer: one top bar on every planner screen (the YAPCO apple, the screens as
  tabs, Export as the main button), a page bar with a "View" menu, no toolbar jumping.
- The YAPCO apple beside the printed page numbers; the title-page line apple as the favicon and
  app icon.
- English proofreading; planners can be created on plain-HTTP addresses; the footer shows the
  deployed version; no build telemetry.

### Offline use (M9)

Done (released in v0.7.0):

- The app is installable (web app manifest, icons) and works offline: a service worker, generated
  after each build (`apps/web/scripts/build-sw.mjs`), keeps every file of the build in the
  browser's cache and serves the app from there; each build replaces the cache as a whole.
  Planners were already stored in the browser, so they can be created, edited and printed from
  the browser offline. Only PDF creation needs the export service.
- Not in development (`pnpm dev`) and not on the print route the PDF service renders.
- An end-to-end test goes offline after one visit and opens the dashboard, the designer and the
  guide, and creates a planner.

### Booklet printing (M9)

Done (released in v0.7.0):

- A5 planners print as folded booklets on A4 paper: "A5 booklet on A4 paper" in the export, with
  1, 2, 4 or 8 sheets per bundle (signature). Pages are laid out in saddle-stitch order with fold
  marks; folded and stacked, the bundles read in order (ADR-0006 amendment, runbook).

### Balance as a first-class edition, and quality (planned as v0.8.0)

Done (released in v0.7.0):

- Quotes per edition: library items can list the modules they need, and the generator deals only
  those that fit. The library grew from 12 to 38 original quotes (32 for every planner, 6 for the
  recovery module), so no quote repeats within a month in any edition.
- The guide follows the edition: an edition picker (opened from the export page, it takes the
  planner's own), neutral guide texts where the wording differs, and no crisis chapter without
  the recovery module.
- Automatic overflow check (end-to-end, in CI): every page of one month, in each edition and
  format and in both languages, with the example filling, fails when printed text is cut off. It
  found and fixed eight real problems (craving card, SOS and gratitude in A5, circled markers,
  and more), and one quote too long for the A4 box beside the date.
- Quote length limits match the layout: up to 100 characters fits A4, 130 fits nowhere.
- Designer: "Module wording" lists every variant of a block with its condition and edits any of
  them directly.

### v0.7.0 — Finishing the content

Done (released in v0.7.0):

- Day page for everyone: "Z kim dziś porozmawiam?" beside the morning commitment, and "Czego
  teraz potrzebuję?" as a line under the HALT-B rows (the per-row "Powód:" stays).
- A new module "Dzień+" (off by default): the rest of S2's "Moje 24 godziny" ("Dzisiaj
  szczególnie uważam na:", "Jeśli będzie trudno, najpierw:") and "Jedna rzecz ważna dla mnie" /
  "Jedna rzecz tylko dla przyjemności", in place of "Plan dnia".
- Warning signs as tick boxes (two columns, a few more examples), with "Moje własne:" lines
  under them; the threshold now counts ticked signs.
- The therapeutic contract replaces "Moja umowa ze sobą" in the Recovery Edition; the agreement
  stays in planners without the recovery module.
- A "Basic" preset (Podstawowy): all modules off.
- Engine: a stack can have a width in a row, and a stack or row whose blocks are all left out
  takes no space; the rating table has an optional line under its rows; category boxes can print
  their examples as tick boxes.

### v0.3.0 — Daily page 2.0: the morning

Completes the daily spread; the evening is done.

Done:

- The long 24-hour commitment is replaced by a "Poranek" block: a check-in (mood, energy,
  tension, craving 0–10, sleep hours and quality 1–5) as numbers spread across one line (A4) or
  two lines of three (A5), and one line "Dziś chronię swoją trzeźwość przez:".
- The header is one line (weekday, date, sobriety day) with the quote beside it (A4) or under it
  (A5); "Plan dnia" stays where it is.
- Evening: "Jutro warto pamiętać" at the bottom of the page.
- Weekly markers: "Mityng AA" stays, and "Grupa" is added (therapy groups such as "Nawroty").
- HALT label "Złość / napięcie" (EN "Angry / tense").

Later:

- If room is needed: the rest of S2's "Moje 24 godziny" and "important / pleasant"
  (e.g. by moving "Plan dnia" into the outer column). "Plan dnia" in A5 is tight (about 4 mm
  per hour) but kept as it is.

### v0.4.0 — Safety and relapse prevention

The pages S1 calls the most valuable; standalone pages, easy to add.

Done. The crisis section, S1–S11, alternating sides with no blank pages:

- S1 "Mój plan na trudny moment": stop (what is happening, ticks) with the SOBER pause, three
  contacts, change the situation (ticks), safe places (A4). Replaces the five-step SOS page.
- S2 "Jak reaguję na głód?": alarm thresholds 0–3 / 4–6 / 7–8 / 9–10 and "when I start
  bargaining with myself".
- S3 "Kiedy nie wiem, co zrobić": emergency list, three best strategies, "Głód jest falą" (where
  in the body, how the strength changes, what helps to ride it out).
- S4–S5 warning signs, now with an own threshold ("Gdy zauważę \_\_ z tych sygnałów") and three
  steps.
- S6 "Mój łańcuch nawrotu"; S7 "Jeśli doszło do potknięcia", without "days lost".
- S8 gains and losses; S9 support network with "when I can call" and "when I feel like
  isolating"; S10–S11 two "Kiedy pojawia się głód" craving cards.

Not done: warning signs as tick boxes (the examples stay as prompts to cross out).

### v0.5.0 — Modules and presets

Before the front matter, because new content has to be split into Core and Recovery.

Done ([ADR-0010](adr/0010-modules-presets-and-block-variants.md)):

- Modules `recovery`, `halt` and `cbt`; presets "Recovery Edition" (recovery + HALT-B) and
  "Balance" (HALT-B only). Pages and sections by `when`, blocks by `visibility`, wording by block
  variants; the designer edits the variant that prints.
- Edition and modules in the new-planner form and in the preview's planner settings (regenerates,
  keeps edits).
- Balance: no sobriety counter, craving, AA / group / therapy markers, contract, safety rules or
  crisis section; neutral wording ("Dziś dbam o siebie przez:", "Co mnie dziś obciążało?", "Co
  mi dziś pomogło?", "Fokus miesiąca", "Sens i duchowość" on the Wheel of Life). About 14 pages
  shorter. A test renders every Balance page and fails on recovery or therapy words.

Not yet: a Balance quote library, a Balance guide booklet, editing variants directly.

### v0.6.0 — "Na dobry początek" (front matter)

Released together with Month 2.0 (below) as **v0.6.0**.

Done:

- A new module `start` ("Na dobry początek"), on in both editions, with six pages after "Jak
  korzystać": "Moja umowa ze sobą" (with "Uzgodnione z terapeutą" only in the recovery module),
  "Dobre życie oznacza dla mnie…", "W moim życiu chcę…" (more / less), "Co jest dla mnie
  naprawdę ważne?" (21 values to tick, top five, how I live them), "Z czego już mogę
  korzystać?" (strengths) and "Moja osobista lista regeneracji".
- "Jak korzystać" rewritten along S2: morning, during the day, evening; "To nie jest
  sprawdzian; to narzędzie do poznawania siebie."
- The cover gets "Nie muszę zmieniać całego życia dzisiaj. Wystarczy, że świadomie przeżyję ten
  dzień."
- The contract and safety rules stay in the recovery module. No new blocks were needed: ruled
  columns and tick lists do the job.
- The introduction is now i–x (Recovery Edition) or i–viii (Balance); six months are about 542
  pages.

### Month 2.0 (released in v0.6.0)

Done:

- Month opening as in S2: "Jak chcę przeżyć ten miesiąc?", "Moja główna intencja", "3 rzeczy,
  które są naprawdę ważne" and "Tego nie muszę robić idealnie" on the left; on the right a value
  to practise this month (from the values page) and "Mój miesiąc w praktyce" (health,
  relationships, rest, growth, pleasure, and recovery in the recovery module). "Recovery focus"
  and "Habits and milestones" are gone. The word of the month stays on the divider page.
- Week: "Moja intencja na ten tydzień", "Trzy najważniejsze rzeczy" (3, was 3–4), and "Mój mały
  eksperyment" on the right-hand page; "Mój tydzień" asks what the experiment showed.
- The month end is four pages: the Wheel of Life (with "Gdzie nastąpiła nawet mała poprawa?"),
  "Co pokazał mi miesiąc?" (a table rolling up the numbers of each "Mój tydzień", then what
  helped, what was hardest, the most common trigger, the most effective strategy, what I
  learned), "Moje wzorce" (when it was hard, states before the risk rose, warning signs, what
  helped most) and "Dalej" (continue, cut down, try, needs attention, word for next month).
  Six months are about 554 pages.
- Wheel of Life areas as in S2: health, emotions, relationships, work / study, finances, growth,
  rest, and recovery (Balance: meaning and spirituality). The wheel is bigger (about 135 mm on
  A4).
- A new "table" block, used for the weekly roll-up and, as labelled lines, for "Mój miesiąc w
  praktyce".
- Deliberate difference: "Ważne terminy" stays a writing area rather than tick boxes, since dates
  have to be written anyway.

## Decisions for v0.3.0

1. "Plan dnia" stays beside the priorities; the space came from a compact check-in and header.
2. Mood is 0–10, like every other scale.
3. "Mityng AA" stays; "Grupa" is added as a separate marker.

## Guard rails (from S1)

- Two pages per day; no more.
- Time to fill in: morning 5–7 minutes, during the day 1–2, evening 7–10. A page that takes
  longer becomes one more duty and is abandoned.
- Not daily: 12-step analysis, the full Wheel of Life, the long ABC, many emotion scales,
  affirmations, compulsory meditation, detailed food tables, many habit trackers.
