import { Suspense } from 'react';
import { PreviewScreen } from '@/components/PreviewScreen';

export default function PreviewPage() {
  return (
    <Suspense fallback={<p className="p-6 text-ink-muted">Loading…</p>}>
      <PreviewScreen />
    </Suspense>
  );
}
