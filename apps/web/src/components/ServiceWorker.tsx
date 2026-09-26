'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (public build only, see scripts/build-sw.mjs), so the app opens
 * and works without a connection. Not in development, where files change on every edit, and not
 * on the print route that the PDF service renders.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    if (window.location.pathname.endsWith('/print')) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline use is an extra; the app works the same without it.
    });
  }, []);
  return null;
}
