import type { Locale } from '@planner/schema';

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/**
 * Picks the plural form for `n` using CLDR rules. Polish needs one/few/many:
 * 1 dzień, 3 dni, 5 dni; English needs one/other. `{n}` in the chosen form is replaced.
 */
export function plural(locale: Locale, n: number, forms: PluralForms): string {
  const rule = new Intl.PluralRules(locale).select(n);
  return (forms[rule] ?? forms.other).replaceAll('{n}', String(n));
}

export type GrammaticalGender = 'slash' | 'feminine' | 'masculine' | 'neutral';

const GENDER_TOKEN = /\{g:([^|{}]*)\|([^|{}]*)(?:\|([^|{}]*))?\}/g;

/**
 * Resolves gendered wording written as `{g:masculine|feminine}` or
 * `{g:masculine|feminine|neutral}` (§7). "Za co jestem dziś {g:wdzięczny|wdzięczna}?" becomes
 * "wdzięczny / wdzięczna" in slash mode. Neutral uses the third form when the author gave one,
 * otherwise the slash form.
 */
export function applyGender(text: string, mode: GrammaticalGender): string {
  return text.replace(GENDER_TOKEN, (_, masculine: string, feminine: string, neutral?: string) => {
    switch (mode) {
      case 'masculine':
        return masculine;
      case 'feminine':
        return feminine;
      case 'neutral':
        return neutral ?? `${masculine} / ${feminine}`;
      default:
        return `${masculine} / ${feminine}`;
    }
  });
}
