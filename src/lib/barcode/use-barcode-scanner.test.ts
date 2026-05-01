import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, render, act } from '@testing-library/react';
import React from 'react';
import { useBarcodeScanner } from './use-barcode-scanner';

function makeMockStream() {
  const track = { stop: vi.fn() };
  let stream: MediaStream;
  try {
    stream = new MediaStream();
  } catch {
    stream = Object.create(MediaStream.prototype) as MediaStream;
  }
  const stopFn = vi.fn();
  stream.getTracks = vi.fn().mockReturnValue([{ stop: stopFn }]);
  return Object.assign(stream, { _track: { stop: stopFn } }) as MediaStream & {
    _track: { stop: ReturnType<typeof vi.fn> };
  };
}

function makeMockDetectorClass(barcodes: Array<{ rawValue: string }> = []) {
  return class MockBarcodeDetector {
    detect = vi.fn().mockResolvedValue(barcodes);
  };
}

describe('useBarcodeScanner', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn().mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as unknown as Record<string, unknown>).BarcodeDetector;
  });

  it('isSupported is false when BarcodeDetector does not exist in window', () => {
    delete (window as unknown as Record<string, unknown>).BarcodeDetector;

    const { result } = renderHook(() => useBarcodeScanner(vi.fn()));

    expect(result.current.isSupported).toBe(false);
  });

  it('isSupported is true when BarcodeDetector exists in window', () => {
    (window as unknown as Record<string, unknown>).BarcodeDetector = makeMockDetectorClass();

    const { result } = renderHook(() => useBarcodeScanner(vi.fn()));

    expect(result.current.isSupported).toBe(true);
  });

  it('startScan calls getUserMedia with facingMode environment', async () => {
    const mockStream = makeMockStream();
    const getUserMedia = vi.fn().mockResolvedValue(mockStream);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    (window as unknown as Record<string, unknown>).BarcodeDetector = makeMockDetectorClass();

    const { result } = renderHook(() => useBarcodeScanner(vi.fn()));

    await act(async () => {
      await result.current.startScan();
    });

    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: 'environment' },
    });
  });

  it('stopScan stops all tracks on the stream', async () => {
    const mockStream = makeMockStream();
    const getUserMedia = vi.fn().mockResolvedValue(mockStream);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    (window as unknown as Record<string, unknown>).BarcodeDetector = makeMockDetectorClass();

    const { result } = renderHook(() => useBarcodeScanner(vi.fn()));

    await act(async () => {
      await result.current.startScan();
    });

    act(() => {
      result.current.stopScan();
    });

    expect(mockStream.getTracks).toHaveBeenCalled();
    expect(mockStream._track.stop).toHaveBeenCalled();
  });

  it('calls onDetected when barcode is found', async () => {
    const mockStream = makeMockStream();
    const getUserMedia = vi.fn().mockResolvedValue(mockStream);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    (window as unknown as Record<string, unknown>).BarcodeDetector = makeMockDetectorClass([
      { rawValue: '1234567890123' },
    ]);

    const detectedFn = vi.fn();
    let capturedStart: (() => Promise<void>) | null = null;

    function HookHost() {
      const { videoRef, startScan } = useBarcodeScanner(detectedFn);
      capturedStart = startScan;
      return React.createElement('video', { ref: videoRef });
    }

    render(React.createElement(HookHost));

    await act(async () => {
      await capturedStart!();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(detectedFn).toHaveBeenCalledWith('1234567890123');
  });

  it('isScanning is false initially', () => {
    const { result } = renderHook(() => useBarcodeScanner(vi.fn()));

    expect(result.current.isScanning).toBe(false);
  });
});
