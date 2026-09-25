import './globals.css';

/** Static 404 for paths outside any locale; bilingual because no locale is known here. */
export default function NotFound() {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <main className="mx-auto max-w-xl px-6 py-16">
          <h1 className="text-xl font-semibold">Page not found · Nie znaleziono strony</h1>
          <p className="mt-4 flex gap-4">
            <a className="underline" href="/en">
              YAPCO (English)
            </a>
            <a className="underline" href="/pl" lang="pl">
              YAPCO (polski)
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
