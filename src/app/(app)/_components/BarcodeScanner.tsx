'use client';

import { useEffect } from 'react';
import { useBarcodeScanner } from '@/lib/barcode/use-barcode-scanner';

interface Props {
  onScanned: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScanned, onClose }: Props) {
  const { videoRef, startScan, stopScan } = useBarcodeScanner(onScanned);

  useEffect(() => {
    startScan();
    return () => stopScan();
  }, []);

  function handleCancel() {
    stopScan();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="h-full w-full object-cover"
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="h-60 w-60 rounded-lg border-2 border-white" />
        <p className="mt-4 text-sm text-white">Apuntá la cámara al código de barras</p>
      </div>

      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-full bg-white px-8 py-3 font-medium text-black"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
