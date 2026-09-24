import { Suspense } from 'react';
import { PrintScreen } from '@/components/PrintScreen';

export default function PrintPage() {
  return (
    <Suspense fallback={null}>
      <PrintScreen />
    </Suspense>
  );
}
