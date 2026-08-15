import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionStatus } from '@capacitor/network';
import { useNetworkStatus } from './useNetworkStatus';

const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  addListener: vi.fn(),
}));

vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: mocks.getStatus,
    addListener: mocks.addListener,
  },
}));

function status(connected: boolean): ConnectionStatus {
  return {
    connected,
    connectionType: connected ? 'wifi' : 'none',
  };
}

describe('useNetworkStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to online and reflects the plugin status', async () => {
    mocks.getStatus.mockResolvedValue(status(false));
    mocks.addListener.mockResolvedValue({ remove: vi.fn() });

    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current).toBe(true);
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('updates when the network comes back', async () => {
    let listener: ((change: ConnectionStatus) => void) | undefined;
    mocks.getStatus.mockResolvedValue(status(false));
    mocks.addListener.mockImplementation(
      (_event: string, cb: (change: ConnectionStatus) => void) => {
        listener = cb;
        return Promise.resolve({ remove: vi.fn() });
      },
    );

    const { result } = renderHook(() => useNetworkStatus());
    await waitFor(() => expect(result.current).toBe(false));

    act(() => {
      listener?.(status(true));
    });

    expect(result.current).toBe(true);
  });

  it('removes the listener on unmount', async () => {
    const remove = vi.fn();
    mocks.getStatus.mockResolvedValue(status(true));
    mocks.addListener.mockResolvedValue({ remove });

    const { unmount } = renderHook(() => useNetworkStatus());
    await act(async () => {});
    unmount();
    await act(async () => {});

    expect(remove).toHaveBeenCalled();
  });
});
