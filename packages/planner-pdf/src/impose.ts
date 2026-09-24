/**
 * Page order for home printing (§8.4, ADR-0006). Page numbers are 1-based; `null` is a blank
 * position (padding).
 */

/** One side of an output sheet holding two pages side by side (A5 on A4 landscape). */
export interface TwoUpSide {
  left: number | null;
  right: number | null;
}

export interface TwoUpSheet {
  front: TwoUpSide;
  /** As seen when the sheet is turned over along its short edge. */
  back: TwoUpSide;
}

const orBlank = (page: number, count: number) => (page <= count ? page : null);

/**
 * Cut-and-stack imposition for two A5 pages per A4 landscape sheet. The left halves of all
 * sheets carry the first half of the planner and the right halves the second half, so after
 * one guillotine cut through the whole stack, placing the right-hand pile under the left-hand
 * pile gives every page in reading order, each back behind its front.
 *
 * The sheet is turned over along its short edge for duplex, which swaps left and right on the
 * back: the page behind the left half's front is printed on the back's right half.
 */
export function cutAndStack(pageCount: number): TwoUpSheet[] {
  const padded = Math.ceil(pageCount / 4) * 4;
  const half = padded / 2;
  return Array.from({ length: padded / 4 }, (_, s) => ({
    front: { left: orBlank(2 * s + 1, pageCount), right: orBlank(half + 2 * s + 1, pageCount) },
    back: { left: orBlank(half + 2 * s + 2, pageCount), right: orBlank(2 * s + 2, pageCount) },
  }));
}

/**
 * Printing on a printer without duplex: print the fronts (odd pages), put the stack back in the
 * tray, then print the backs (even pages). Most home printers need the backs in reverse order;
 * the calibration sheet shows which way round a given printer needs.
 */
export function manualDuplex(
  pageCount: number,
  reverseBacks = true,
): { fronts: (number | null)[]; backs: (number | null)[] } {
  const sheets = Math.ceil(pageCount / 2);
  const fronts = Array.from({ length: sheets }, (_, s) => orBlank(2 * s + 1, pageCount));
  const backs = Array.from({ length: sheets }, (_, s) => orBlank(2 * s + 2, pageCount));
  return { fronts, backs: reverseBacks ? backs.reverse() : backs };
}
