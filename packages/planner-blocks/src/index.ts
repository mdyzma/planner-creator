import {
  calendarGridBlock,
  dayHeaderBlock,
  dayStripBlock,
  markerLegendBlock,
} from './blocks/calendar';
import { quoteBlock, textBlock } from './blocks/text';
import {
  categoryGridBlock,
  contactTableBlock,
  dividerBlock,
  radialScaleBlock,
  spacerBlock,
} from './blocks/therapeutic';
import { ratingMatrixBlock, timeGridBlock } from './blocks/tracking';
import { numberedListBlock, writingAreaBlock } from './blocks/writing';
import { createBlockRegistry } from './registry';

export * from './registry';
export * from './presets';
export { MARKERS, MarkerIcon, type MarkerKey } from './blocks/calendar';

/** Every block type that ships with the app. */
export const BUILT_IN_BLOCKS = [
  textBlock,
  quoteBlock,
  writingAreaBlock,
  numberedListBlock,
  ratingMatrixBlock,
  timeGridBlock,
  calendarGridBlock,
  dayHeaderBlock,
  dayStripBlock,
  markerLegendBlock,
  radialScaleBlock,
  categoryGridBlock,
  contactTableBlock,
  dividerBlock,
  spacerBlock,
];

export const createDefaultRegistry = () => createBlockRegistry(BUILT_IN_BLOCKS);
