'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
  const onDetectedRef = useRef(onDetected);
  const [isScanning, setIsScanning] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  });

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && 'BarcodeDetector' in window);
  }, []);

  const stopScan = useCallback(function stopScan() {
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
  }, []);

  const startScan = useCallback(async function startScan() {
    if (typeof window === 'undefined' || !window.BarcodeDetector) return;

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

    const detector = new window.BarcodeDetector({ formats: FORMATS });

    function loop() {
      if (!videoRef.current) return;

      detector.detect(videoRef.current).then((barcodes) => {
        if (barcodes.length > 0) {
          onDetectedRef.current(barcodes[0].rawValue);
          stopScan();
        } else {
          rafRef.current = requestAnimationFrame(loop);
        }
      }).catch(() => {
        rafRef.current = requestAnimationFrame(loop);
      });
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [stopScan]);

  return { videoRef, isSupported, isScanning, startScan, stopScan };
}
