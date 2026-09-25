import { z } from 'zod';

/**
 * How a section's pages are numbered: arabic (1, 2, 3), roman (i, ii, iii) or not at all, with an
 * optional prefix (S1, S2). Each style and prefix is its own sequence, continued across sections
 * unless `restart` starts it again at 1. Sections without a setting follow their parent; the
 * planner as a whole defaults to arabic.
 */
export const PageNumbering = z.object({
  style: z.enum(['arabic', 'roman', 'none']),
  prefix: z.string().max(4).optional(),
  restart: z.boolean().optional(),
});
export type PageNumbering = z.infer<typeof PageNumbering>;
