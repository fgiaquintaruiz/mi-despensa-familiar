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

  it('startScan suppresses play() rejection (autoplay policy)', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(99));

    const mockStream = makeMockStream();
    const getUserMedia = vi.fn().mockResolvedValue(mockStream);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    (window as unknown as Record<string, unknown>).BarcodeDetector = makeMockDetectorClass();

    let capturedStart: (() => Promise<void>) | null = null;
    function HookHostPlay() {
      const { videoRef, startScan } = useBarcodeScanner(vi.fn());
      capturedStart = startScan;
      const ref = videoRef as React.RefObject<HTMLVideoElement>;
      return React.createElement('video', {
        ref: (el: HTMLVideoElement | null) => {
          if (el) {
            Object.defineProperty(el, 'play', {
              value: vi.fn().mockRejectedValue(new DOMException('NotAllowedError')),
              configurable: true,
            });
            (ref as unknown as { current: HTMLVideoElement }).current = el;
          }
        },
      });
    }
    render(React.createElement(HookHostPlay));

    await act(async () => {
      await expect(capturedStart!()).resolves.toBeUndefined();
    });
  });

  it('startScan returns early when BarcodeDetector is not in window', async () => {
    const getUserMedia = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    delete (window as unknown as Record<string, unknown>).BarcodeDetector;

    const { result } = renderHook(() => useBarcodeScanner(vi.fn()));

    await act(async () => {
      await result.current.startScan();
    });

    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('stopScan when rafRef is null skips cancelAnimationFrame', () => {
    const cancelRAF = vi.mocked(cancelAnimationFrame);
    const { result } = renderHook(() => useBarcodeScanner(vi.fn()));

    act(() => {
      result.current.stopScan();
    });

    expect(cancelRAF).not.toHaveBeenCalled();
  });

  it('loop: schedules another rAF when no barcodes are detected', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(2));

    const mockStream = makeMockStream();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) } });

    let resolveDetect!: (value: Array<{ rawValue: string }>) => void;
    const detectPromise = new Promise<Array<{ rawValue: string }>>((res) => { resolveDetect = res; });
    const MockDetector = class { detect = vi.fn().mockReturnValue(detectPromise); };
    (window as unknown as Record<string, unknown>).BarcodeDetector = MockDetector;

    const detectedFn = vi.fn();
    let capturedStart: (() => Promise<void>) | null = null;
    function HookHost() {
      const { videoRef, startScan } = useBarcodeScanner(detectedFn);
      capturedStart = startScan;
      return React.createElement('video', { ref: videoRef });
    }
    render(React.createElement(HookHost));

    await act(async () => { await capturedStart!(); });

    const rafMock = vi.mocked(requestAnimationFrame);
    const loopFn = rafMock.mock.calls[0][0] as FrameRequestCallback;

    rafMock.mockClear();
    loopFn(0);

    await act(async () => { resolveDetect([]); });

    expect(rafMock).toHaveBeenCalled();
    expect(detectedFn).not.toHaveBeenCalled();
  });

  it('loop: schedules another rAF when detect() rejects', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(3));

    const mockStream = makeMockStream();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(mockStream) } });

    let rejectDetect!: (err: Error) => void;
    const detectPromise = new Promise<Array<{ rawValue: string }>>((_, rej) => { rejectDetect = rej; });
    const MockDetector = class { detect = vi.fn().mockReturnValue(detectPromise); };
    (window as unknown as Record<string, unknown>).BarcodeDetector = MockDetector;

    const detectedFn = vi.fn();
    let capturedStart: (() => Promise<void>) | null = null;
    function HookHost2() {
      const { videoRef, startScan } = useBarcodeScanner(detectedFn);
      capturedStart = startScan;
      return React.createElement('video', { ref: videoRef });
    }
    render(React.createElement(HookHost2));

    await act(async () => { await capturedStart!(); });

    const rafMock = vi.mocked(requestAnimationFrame);
    const loopFn = rafMock.mock.calls[0][0] as FrameRequestCallback;

    rafMock.mockClear();
    loopFn(0);

    await act(async () => { rejectDetect(new Error('sensor error')); });

    expect(rafMock).toHaveBeenCalled();
    expect(detectedFn).not.toHaveBeenCalled();
  });
});
