# YAPCO brand

YAPCO — *Yet Another Planner Creator*. The mark is a line-drawn apple whose outline runs on into
a tick: one continuous line, with a leaf on the stem
([`concepts/concept-2-line-apple.svg`](concepts/concept-2-line-apple.svg)). The apple comes from
the orchard region the project is made in; the tick is the planner's promise of a day lived with
awareness.

Where it is used:

- the planner's title page, above the title;
- beside the page number on every printed page (`BrandMark` in `packages/planner-renderer`);
- the app: the dashboard header and the top bar of every planner screen (`BrandMark` again);
- the browser tab and the installed app's icon (the files below).

| File | Use |
| --- | --- |
| `concepts/concept-2-line-apple.svg` | The master drawing, for print and large sizes |
| `yapco-icon.svg` | Browser tab icon, 16–32 px: the line apple on a dark tile, with a heavier line; same file as `apps/web/app/icon.svg` |
| `yapco-icon-large.svg` | The same with a lighter line, for the 192 and 512 px app icons (`apps/web/public/icons/icon-192.png`, `icon-512.png`) |
| `yapco-icon-maskable.svg` | Full-bleed tile with the apple in the central safe circle, for `icon-maskable-512.png` (phones crop it to a circle or squircle) |
| `yapco-logo.svg`, `yapco-mark.svg` | The earlier mark, an apple-shaped planner with binder rings and a checklist. No longer used in the app; kept for reference. |

Colours: ink `#1e2424` (dark theme `#e6e2da`). On the dark icon tile the line is `#e6e2da` on
`#1e2424`. The mark is drawn in one colour; it takes the colour of the text around it.

Keep it clear of Apple Inc.'s logo: the leaf always sits on the stem, and the outline never has a
bite or a gap. The tick inside the apple carries the meaning. In the app the name is shown as
"YAPCO" alone; the tagline is for the README and about pages.

The PNG app icons are rendered from these SVGs in Chrome at exactly 192 and 512 px (transparent
corners for the rounded tile).
