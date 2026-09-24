import type { ReactNode } from 'react';

/** Pass-through: `app/[locale]/layout.tsx` renders <html> with the right `lang` (§7). */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
