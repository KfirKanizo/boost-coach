import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

/**
 * Shared jsdom polyfills.
 *
 * MediaPipeCameraTracker mounts a real `Worker` and calls `getUserMedia` on
 * mount. jsdom provides neither, so the tracker tests stub them here. The real
 * vision worker module is never loaded in tests — the stub worker only records
 * protocol messages.
 */

export class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();

  terminate(): void {}

  /** Simulate the real worker posting a protocol message back. */
  emit(message: unknown): void {
    this.onmessage?.({ data: message } as MessageEvent);
  }

  emitError(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

const fakeWorkers: FakeWorker[] = [];

export function getFakeWorkers(): FakeWorker[] {
  return fakeWorkers;
}

class WorkerStub extends FakeWorker {
  constructor() {
    super();
    fakeWorkers.push(this);
  }
}

vi.stubGlobal('Worker', WorkerStub);

Object.defineProperty(navigator, 'mediaDevices', {
  configurable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
      getVideoTracks: () => [{ stop: vi.fn() }],
    }),
  },
});

vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }));
