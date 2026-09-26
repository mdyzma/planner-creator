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
  imageBlock,
  radialScaleBlock,
  spacerBlock,
} from './blocks/therapeutic';
import { ratingMatrixBlock, timeGridBlock } from './blocks/tracking';
import { numberedListBlock, tableBlock, writingAreaBlock } from './blocks/writing';
import { createBlockRegistry } from './registry';

export * from './registry';
export * from './presets';
export * from './samples';
export { MARKERS, MarkerIcon, type MarkerKey } from './blocks/calendar';

/** Every block type that ships with the app. */
export const BUILT_IN_BLOCKS = [
  textBlock,
  quoteBlock,
  writingAreaBlock,
  numberedListBlock,
  tableBlock,
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
  imageBlock,
  spacerBlock,
];

export const createDefaultRegistry = () => createBlockRegistry(BUILT_IN_BLOCKS);
