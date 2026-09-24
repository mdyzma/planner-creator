import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/** Locale-aware Link and router: links keep the current interface language. */
export const { Link, usePathname, useRouter } = createNavigation(routing);
