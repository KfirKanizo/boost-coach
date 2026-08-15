import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayout } from './AppLayout';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useOfflineSync } from '../hooks/useOfflineSync';

vi.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: vi.fn(),
}));

vi.mock('../hooks/useOfflineSync', () => ({
  useOfflineSync: vi.fn(),
}));

describe('AppLayout', () => {
  beforeEach(() => {
    vi.mocked(useNetworkStatus).mockReturnValue(true);
    vi.mocked(useOfflineSync).mockReturnValue(undefined);
  });

  function renderLayout() {
    return render(
      <AppLayout activeTab="flow" onTabChange={vi.fn()}>
        <p>Page content</p>
      </AppLayout>,
    );
  }

  it('shows the offline indicator when disconnected', () => {
    vi.mocked(useNetworkStatus).mockReturnValue(false);

    renderLayout();

    expect(screen.getByRole('status')).toHaveTextContent(
      'Offline Mode - Progress saved locally',
    );
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('hides the offline indicator when connected', () => {
    renderLayout();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('triggers an offline sync flush when connected', () => {
    renderLayout();

    expect(useOfflineSync).toHaveBeenCalledWith(true);
  });
});
