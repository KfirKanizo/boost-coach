import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import type { UserProfile } from '../api/client';
import { OnboardingWizard } from './OnboardingWizard';

vi.mock('../api/client', () => ({
  api: {
    getUserProfile: vi.fn(),
    updateUserProfile: vi.fn(),
  },
}));

vi.mock('../services/profileStorage', () => ({
  getProfileName: vi.fn().mockReturnValue(''),
  setProfileName: vi.fn(),
  getProfilePicture: vi.fn().mockReturnValue(null),
  setProfilePicture: vi.fn(),
}));

import { setProfileName, setProfilePicture } from '../services/profileStorage';

function mockProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u-1',
    email: 'test@boostcoach.fit',
    gender: null,
    age: null,
    weight: null,
    height: null,
    current_streak: 0,
    fitness_goals: null,
    fitness_styles: null,
    ...overrides,
  };
}

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingWizard />} />
        <Route path="/" element={<div>The Flow</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OnboardingWizard', () => {
  beforeEach(() => {
    vi.mocked(api.getUserProfile).mockReset();
    vi.mocked(api.updateUserProfile).mockReset();
    vi.mocked(api.getUserProfile).mockResolvedValue(mockProfile());
    vi.mocked(setProfileName).mockReset();
    vi.mocked(setProfilePicture).mockReset();
  });

  it('renders step 1 with name input and welcome text', async () => {
    renderWizard();

    expect(await screen.findByText('Welcome aboard!')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('navigates forward and backward through steps', async () => {
    renderWizard();
    await screen.findByText('Welcome aboard!');

    // Step 1: Name — just click next (name is optional)
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 2: Gender
    expect(await screen.findByText("What's your gender?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    // Back to step 1
    expect(await screen.findByText('Welcome aboard!')).toBeInTheDocument();
  });

  it('completes full wizard and saves profile', async () => {
    vi.mocked(api.updateUserProfile).mockResolvedValue(mockProfile({
      gender: 'female',
      age: 25,
      weight: 60,
      height: 165,
      fitness_goals: ['weight_loss'],
      fitness_styles: ['yoga'],
    }));

    renderWizard();
    await screen.findByText('Welcome aboard!');

    // Step 1: Name
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Alice' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 2: Gender
    expect(await screen.findByText("What's your gender?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^female$/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 3: Metrics (defaults are fine)
    expect(await screen.findByText('Your metrics')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 4: Goals
    expect(await screen.findByText('Your goals')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /weight loss/i }));
    fireEvent.click(screen.getByRole('button', { name: /yoga/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 5: Summary — find the Let's Go button
    const letsGo = await screen.findByRole('button', { name: /let's go/i });
    fireEvent.click(letsGo);

    expect(await screen.findByText('The Flow')).toBeInTheDocument();
    expect(api.updateUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        gender: 'female',
        fitness_goals: ['weight_loss'],
        fitness_styles: ['yoga'],
      }),
    );
    expect(setProfileName).toHaveBeenCalledWith('Alice');
  });

  it('shows error when save fails', async () => {
    vi.mocked(api.updateUserProfile).mockRejectedValue(new Error('Network error'));

    renderWizard();
    await screen.findByText('Welcome aboard!');

    // Step 0: Name → Next
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 1: Gender → select Male → Next
    expect(await screen.findByText("What's your gender?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^male$/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 2: Metrics → Next
    expect(await screen.findByText('Your metrics')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 3: Goals → Next
    expect(await screen.findByText('Your goals')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 4: Summary → Let's Go
    const letsGo = await screen.findByRole('button', { name: /let's go/i });
    fireEvent.click(letsGo);

    expect(await screen.findByText(/could not save/i)).toBeInTheDocument();
  });

  it('pre-fills from existing profile', async () => {
    vi.mocked(api.getUserProfile).mockResolvedValue(
      mockProfile({ gender: 'male', age: 30, weight: 80, height: 180 }),
    );

    renderWizard();
    await screen.findByText('Welcome aboard!');

    // Navigate to step 2
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText("What's your gender?");

    // Wait for profile to load and pre-fill gender, then click Next
    // Gender is pre-selected as 'male' from profile, so Next should be enabled
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText('Your metrics');

    // Values should be pre-filled from profile
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('180')).toBeInTheDocument();
  });

  it('shows BMI summary on last step', async () => {
    renderWizard();
    await screen.findByText('Welcome aboard!');

    // Skip through all steps to reach summary
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText("What's your gender?");

    fireEvent.click(screen.getByRole('button', { name: /^male$/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText('Your metrics');

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText('Your goals');

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText("You're all set!");

    // BMI should be visible
    expect(screen.getByText('BMI')).toBeInTheDocument();
    expect(screen.getByText("Let's Go")).toBeInTheDocument();
  });
});
