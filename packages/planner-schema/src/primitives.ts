import { z } from 'zod';

/** Supported content locales. Extend here to add a language (docs/adr/0005). */
export const LOCALES = ['en', 'pl'] as const;
export const Locale = z.enum(LOCALES);
export type Locale = z.infer<typeof Locale>;

/** Translatable text. A missing key means "not translated yet"; it is reported, never fatal. */
export const LocalizedText = z.partialRecord(Locale, z.string());
export type LocalizedText = z.infer<typeof LocalizedText>;

export const Side = z.enum(['left', 'right']);
export type Side = z.infer<typeof Side>;

/** Millimetres. All physical geometry in documents is stored in mm. */
export const Mm = z.number().finite().min(0).max(1000);

/** Size along one axis: fixed mm, a fraction of remaining space, or content-sized. */
export const Length = z.union([
  z.object({ mm: Mm }),
  z.object({ fr: z.number().finite().positive().max(100) }),
  z.literal('auto'),
]);
export type Length = z.infer<typeof Length>;

/** Calendar date without time zone, `YYYY-MM-DD`. */
export const IsoDate = z.iso.date();
export type IsoDate = z.infer<typeof IsoDate>;

export const IsoDateTime = z.iso.datetime({ offset: true });

/** Stable identifier used for templates, blocks, content items and projects. */
export const Id = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/, 'ids use letters, digits and . _ : / -');
export type Id = z.infer<typeof Id>;
