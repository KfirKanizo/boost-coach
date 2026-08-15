import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import type { UserProfile } from '../api/client';
import { clearAuthToken } from '../services/tokenStorage';
import { ProfilePage } from './ProfilePage';

vi.mock('../api/client', () => ({
  api: { getUserProfile: vi.fn() },
}));

vi.mock('../services/tokenStorage', () => ({
  clearAuthToken: vi.fn(),
}));

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u-1',
    email: 'test@boostcoach.fit',
    weight: 70,
    height: 175,
    current_streak: 3,
    ...overrides,
  };
}

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/login" element={<div>Login Screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.mocked(api.getUserProfile).mockReset();
    vi.mocked(clearAuthToken).mockReset();
  });

  it('displays the fetched email, metrics, and streak', async () => {
    vi.mocked(api.getUserProfile).mockResolvedValue(profile());

    renderProfile();

    expect(await screen.findByText('test@boostcoach.fit')).toBeInTheDocument();
    expect(screen.getByText('70')).toBeInTheDocument();
    expect(screen.getByText('175')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Day streak')).toBeInTheDocument();
  });

  it('shows placeholders for unset metrics', async () => {
    vi.mocked(api.getUserProfile).mockResolvedValue(
      profile({ weight: null, height: null }),
    );

    renderProfile();

    expect(await screen.findByText('test@boostcoach.fit')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('clears the token and navigates to /login on logout', async () => {
    vi.mocked(api.getUserProfile).mockResolvedValue(profile());
    vi.mocked(clearAuthToken).mockResolvedValue(undefined);

    renderProfile();

    await userEvent.click(
      await screen.findByRole('button', { name: /log out/i }),
    );

    expect(clearAuthToken).toHaveBeenCalled();
    expect(await screen.findByText('Login Screen')).toBeInTheDocument();
  });

  it('surfaces an error with retry when the fetch fails', async () => {
    vi.mocked(api.getUserProfile)
      .mockRejectedValueOnce(new Error('Could not load your profile'))
      .mockResolvedValueOnce(profile());

    renderProfile();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load your profile',
    );

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('test@boostcoach.fit')).toBeInTheDocument();
  });
});
