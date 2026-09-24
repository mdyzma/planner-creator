import { z } from 'zod';
import { Id, Locale, LocalizedText } from './primitives';

export const ContentKind = z.enum([
  'quote',
  'affirmation',
  'prompt',
  'sos-step',
  'warning-sign',
  'exercise',
]);
export type ContentKind = z.infer<typeof ContentKind>;

/** `user` items stay in the author's projects and are flagged on template export (§4.5.1). */
export const ContentLicense = z.enum(['original', 'public-domain', 'cc-by', 'user']);

export const ContentItem = z.object({
  id: Id,
  kind: ContentKind,
  text: LocalizedText,
  author: z.string().max(200).optional(),
  source: z.string().max(500).optional(),
  license: ContentLicense,
  categories: z.array(z.string().max(100)),
  tags: z.array(z.string().max(100)),
  scope: z
    .object({
      months: z.array(z.number().int().min(1).max(12)).optional(),
      weeks: z.array(z.number().int().min(1).max(60)).optional(),
    })
    .optional(),
  /** Per-locale translation review status; machine drafts must be reviewed before export. */
  review: z.partialRecord(Locale, z.enum(['draft', 'reviewed'])).optional(),
});
export type ContentItem = z.infer<typeof ContentItem>;

export const ContentLibrary = z.object({
  schemaVersion: z.number().int().min(1),
  library: Id,
  items: z.array(ContentItem),
});
export type ContentLibrary = z.infer<typeof ContentLibrary>;

/** How a block selects items from a library at generation time. */
export const ContentSelector = z.object({
  source: ContentKind,
  filter: z
    .object({
      categories: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
  strategy: z.enum(['sequential', 'seeded-shuffle', 'themed-by-month']),
  noRepeatWithin: z.number().int().min(0).max(366).optional(),
});
export type ContentSelector = z.infer<typeof ContentSelector>;
