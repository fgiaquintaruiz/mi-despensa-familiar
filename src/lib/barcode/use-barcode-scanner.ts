'use client';

import { useEffect, useRef, useState } from 'react';

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] as const;

declare class BarcodeDetector {
  constructor(options: { formats: readonly string[] });
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}

declare global {
  interface Window {
    BarcodeDetector?: typeof BarcodeDetector;
  }
}

export function useBarcodeScanner(onDetected: (barcode: string) => void): {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isSupported: boolean;
  isScanning: boolean;
  startScan: () => Promise<void>;
  stopScan: () => void;
} {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && 'BarcodeDetector' in window);
  }, []);

  function stopScan() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }

  async function startScan() {
    if (!isSupported) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }

    if (videoRef.current) {
      await videoRef.current.play().catch(() => {});
    }

    setIsScanning(true);

    const detector = new window.BarcodeDetector!({ formats: FORMATS });

    function loop() {
      if (!videoRef.current) return;

      detector.detect(videoRef.current).then((barcodes) => {
        if (barcodes.length > 0) {
          onDetected(barcodes[0].rawValue);
          stopScan();
        } else {
          rafRef.current = requestAnimationFrame(loop);
        }
      }).catch(() => {
        rafRef.current = requestAnimationFrame(loop);
      });
    }

    rafRef.current = requestAnimationFrame(loop);
  }

  return { videoRef, isSupported, isScanning, startScan, stopScan };
}
