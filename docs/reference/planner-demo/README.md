# Planner demo (frozen reference)

A copy of the original static mock-up (`therapy-platform/planner-demo/`, taken 2026-09-24). It is kept
**only as a visual and interaction reference** for the system design
([§2.2](../../architecture/system-design.md)). Don't extend it and don't import from it.

Run it:

```bash
python3 -m http.server 8088 --directory docs/reference/planner-demo
```

Known differences from the target design:
- Polish only, A4 only; all strings and dimensions are hard-coded.
- The daily spread puts reflections on the left and the plan on the right. The target design
  **reverses** this (Morning & Day left, Evening right).
- Uses emoji as icons, colour-only HALT coding, and live `<input>` fields on printed pages. None of
  these carry over.

**Quotes:** the original demo quoted third-party authors and publications (AA literature,
V. Frankl, B. Brown, M. Linehan, C. Rogers, P. Hemphill). In this copy they were replaced on
2026-09-24 with 12 newly written sentences on the same themes. These are not paraphrases of the
originals, and they are marked "Sentencja autorska". The same 12 sentences, with English versions,
seed [`templates/therapeutic-recovery/content/quotes.json`](../../../templates/therapeutic-recovery/content/quotes.json).
