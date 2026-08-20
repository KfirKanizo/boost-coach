import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import type { UserProfile } from '../api/client';
import { clearAuthToken } from '../services/tokenStorage';
import {
  getProfileName,
  setProfileName,
  getProfilePicture,
  setProfilePicture,
} from '../services/profileStorage';
import { ProfilePage } from './ProfilePage';

vi.mock('../api/client', () => ({
  api: {
    getUserProfile: vi.fn(),
    updateUserProfile: vi.fn(),
  },
}));

vi.mock('../services/tokenStorage', () => ({
  clearAuthToken: vi.fn(),
}));

vi.mock('../services/profileStorage', () => ({
  getProfileName: vi.fn().mockReturnValue(''),
  setProfileName: vi.fn(),
  getProfilePicture: vi.fn().mockReturnValue(null),
  setProfilePicture: vi.fn(),
}));

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u-1',
    email: 'test@boostcoach.fit',
    gender: null,
    age: null,
    weight: 70,
    height: 175,
    current_streak: 3,
    fitness_goals: null,
    fitness_styles: null,
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
    vi.mocked(api.updateUserProfile).mockReset();
    vi.mocked(clearAuthToken).mockReset();
    vi.mocked(getProfileName).mockReturnValue('');
    vi.mocked(getProfilePicture).mockReturnValue(null);
    vi.mocked(setProfileName).mockReset();
    vi.mocked(setProfilePicture).mockReset();
  });

  it('displays the fetched email and metrics', async () => {
    vi.mocked(api.getUserProfile).mockResolvedValue(profile());

    renderProfile();

    expect(await screen.findByText('test@boostcoach.fit')).toBeInTheDocument();
    expect(screen.getByText('70 kg')).toBeInTheDocument();
    expect(screen.getByText('175 cm')).toBeInTheDocument();
  });

  it('shows placeholders for unset metrics', async () => {
    vi.mocked(api.getUserProfile).mockResolvedValue(
      profile({ weight: null, height: null }),
    );

    renderProfile();

    expect(await screen.findByText('test@boostcoach.fit')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
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

  it('enters edit mode when Edit is clicked', async () => {
    vi.mocked(api.getUserProfile).mockResolvedValue(profile());

    renderProfile();
    await screen.findByText('test@boostcoach.fit');

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.queryByText('Your details')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByText('Gender')).toBeInTheDocument();
  });

  it('saves profile changes and exits edit mode', async () => {
    vi.mocked(api.getUserProfile).mockResolvedValue(profile());
    vi.mocked(api.updateUserProfile).mockResolvedValue(
      profile({ gender: 'male', age: 28, weight: 75 }),
    );

    renderProfile();
    await screen.findByText('test@boostcoach.fit');

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    await screen.findByRole('button', { name: /save/i });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(api.updateUserProfile).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('shows onboarding data in view mode when present', async () => {
    vi.mocked(api.getUserProfile).mockResolvedValue(
      profile({
        gender: 'female',
        age: 25,
        fitness_goals: ['weight_loss', 'endurance'],
        fitness_styles: ['gym'],
      }),
    );

    renderProfile();
    await screen.findByText('test@boostcoach.fit');

    expect(screen.getByText('female', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('25 yrs')).toBeInTheDocument();
    expect(screen.getByText('weight loss')).toBeInTheDocument();
    expect(screen.getByText('endurance')).toBeInTheDocument();
    expect(screen.getByText('gym')).toBeInTheDocument();
  });

  it('displays local profile name when available', async () => {
    vi.mocked(getProfileName).mockReturnValue('Alice');
    vi.mocked(api.getUserProfile).mockResolvedValue(profile());

    renderProfile();

    // Should show "Alice" in header subtitle
    expect(await screen.findByText('Alice')).toBeInTheDocument();
  });

  it('allows editing local name inside unified edit mode', async () => {
    vi.mocked(api.getUserProfile).mockResolvedValue(profile());
    vi.mocked(api.updateUserProfile).mockResolvedValue(profile());

    renderProfile();
    await screen.findByText('test@boostcoach.fit');

    // Click the Edit button to enter unified edit mode
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    // The name input should be visible in edit mode
    const nameInput = screen.getByPlaceholderText('Your name');
    expect(nameInput).toBeInTheDocument();

    // Type a new name
    await userEvent.type(nameInput, 'Alice');

    // Save — this persists both localStorage name AND backend metrics
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(setProfileName).toHaveBeenCalledWith('Alice');
    expect(api.updateUserProfile).toHaveBeenCalled();
  });

  it('cancels edit mode without saving', async () => {
    vi.mocked(api.getUserProfile).mockResolvedValue(profile());

    renderProfile();
    await screen.findByText('test@boostcoach.fit');

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    await screen.findByPlaceholderText('Your name');

    // Cancel should exit edit mode
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.getByText('Your details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(setProfileName).not.toHaveBeenCalled();
  });
});
