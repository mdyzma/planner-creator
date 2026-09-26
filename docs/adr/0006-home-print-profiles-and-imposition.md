# ADR-0006: Home-printer print profiles and imposition

Status: Proposed · Date: 2026-09-24

## Context
Planners will be printed on the user's own hardware, not by a print shop. Home printers can't print
to the paper edge, many can't duplex, print dialogs scale to fit by default, and A5 paper is rarely
loaded. The brief still asks for sewn-binding-aware margins.

## Decision
- Export is driven by **print profiles**: `home-duplex` (default), `home-manual-duplex`,
  `home-a5-2up`, `home-booklet` (folded signatures, default 16 pages), and a later `print-shop`
  (bleed + crop marks).
- Home profiles: bleed 0, no crop marks, margins clamped to a printer-safe minimum (default 5 mm).
- Imposition is a post-render step using `pdf-lib` `embedPage`, so output stays vector.
- The PDF sets `ViewerPreferences` (`PrintScaling None`, `Duplex`), the export dialog tells the user
  to print at 100 %, and an optional calibration page checks scale and duplex registration.
- CMYK / PDF/X is out of scope.

## Alternatives
- **Print-shop-first (bleed, crops, PDF/X)**: wrong target; crop marks and bleed waste paper at home.
- **Rely on the OS print dialog for booklets/2-up**: dialog features differ by OS and driver and
  usually rasterise or rescale. Rejected.

## Consequences
+ A5 planners can be printed on A4 paper and sewn at home (`home-booklet`), which suits sewn binding.
+ Duplex misregistration (1–3 mm) is covered by the ≥ 15 mm mirrored inner margin.
− Scaling can't be fully enforced; some viewers ignore `PrintScaling`, so we rely on the
  instructions and the calibration page.

## Amendment (2026-09-24): ring binding
Users bind **both A4 and A5 with rings**. Defaults become `home-duplex` (A4) and `home-a5-2up` with
cut-and-stack ordering (A5 on A4 paper). A `ring` binding setting reserves a hole-punch zone (inner
margin ≥ 18 mm for ISO 838 2-hole) and can print punch guides. Months are **sheet-aligned** (start on
a recto, end on a verso) so they can be printed and filed one at a time. `home-booklet` is moved to later.

## Amendment (2026-09-26): booklets
`home-booklet` is built for A5 planners on A4 paper: the pages are split into **signatures** of
1, 2, 4 (default) or 8 sheets, laid out in saddle-stitch order (in a bundle of P pages, sheet i
carries P − 2i | 1 + 2i on the front and 2 + 2i | P − 1 − 2i on the back), with fold marks at the
top and bottom of the centre line, short-edge duplex. Folded and stacked, the bundles read in
order and can be sewn or stapled. The sheets per signature are an export option, like the order
of the backs for manual duplex. Creep (inner sheets sticking out after folding) is not
compensated; at 4–8 sheets it is well under a millimetre on normal paper.
