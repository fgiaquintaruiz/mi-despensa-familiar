'use client';

import { useRouter } from 'next/navigation';
import BarcodeScanner from '../_components/BarcodeScanner';

export default function ScannerPage() {
  const router = useRouter();

  function handleScanned(_barcode: string) {
    router.back();
  }

  function handleClose() {
    router.back();
  }

  return <BarcodeScanner onScanned={handleScanned} onClose={handleClose} />;
}
