import { LocaleRedirect } from '@/components/LocaleRedirect';
import './globals.css';

/** `/` has no language; send the visitor to their saved or browser language. */
export default function RootPage() {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <LocaleRedirect />
      </body>
    </html>
  );
}
