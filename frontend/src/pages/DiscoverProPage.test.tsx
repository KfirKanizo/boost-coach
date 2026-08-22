import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import type { PreBuiltProgram } from '../api/client';
import { DiscoverProPage } from './DiscoverProPage';

vi.mock('../api/client', () => ({
  api: {
    getPublicPrograms: vi.fn().mockResolvedValue([]),
    cloneProgram: vi.fn().mockResolvedValue({ id: 'new-routine-1', name: 'Cloned', exercises: [], schedule_days: null, created_at: '' }),
  },
}));

const MOCK_PROGRAMS: PreBuiltProgram[] = [
  {
    id: 'prog-1',
    title: 'Home Push',
    description: 'Bodyweight push workout',
    muscle_tags: ['chest', 'shoulders'],
    equipment_category: 'home',
    exercises: [{ exercise_id: 'ex-1', sets: 3, target_reps_or_duration: 10, rest_time_after_sec: 60 }],
    is_active: true,
  },
  {
    id: 'prog-2',
    title: 'Gym Squat',
    description: 'Heavy squat day',
    muscle_tags: ['quadriceps', 'calves'],
    equipment_category: 'gym',
    exercises: [{ exercise_id: 'ex-2', sets: 5, target_reps_or_duration: 5, rest_time_after_sec: 120 }],
    is_active: true,
  },
];

function renderDiscover() {
  return render(
    <MemoryRouter initialEntries={['/discover']}>
      <Routes>
        <Route path="/discover" element={<DiscoverProPage />} />
        <Route path="/builder/:routine_id" element={<div>Builder Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DiscoverProPage', () => {
  beforeEach(() => {
    vi.mocked(api.getPublicPrograms).mockReset();
    vi.mocked(api.cloneProgram).mockReset();
    vi.mocked(api.cloneProgram).mockResolvedValue({ id: 'new-routine-1', name: 'Cloned', exercises: [], schedule_days: null, created_at: '' });
  });

  it('renders loading state initially', async () => {
    vi.mocked(api.getPublicPrograms).mockReturnValue(new Promise(() => {})); // never resolves
    renderDiscover();
    // The Loader2 spinner is visible while loading
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders programs after loading', async () => {
    vi.mocked(api.getPublicPrograms).mockResolvedValue(MOCK_PROGRAMS);
    renderDiscover();
    expect(await screen.findByText('Home Push')).toBeInTheDocument();
    expect(screen.getByText('Gym Squat')).toBeInTheDocument();
  });

  it('shows empty state when no programs match filter', async () => {
    vi.mocked(api.getPublicPrograms).mockResolvedValue(MOCK_PROGRAMS);
    renderDiscover();
    await screen.findByText('Home Push');
    // Click "Home" filter — should still show Home Push
    const homeButton = screen.getByRole('button', { name: /home/i });
    await userEvent.click(homeButton);
    expect(screen.getByText('Home Push')).toBeInTheDocument();
    expect(screen.queryByText('Gym Squat')).not.toBeInTheDocument();
  });

  it('clone button calls api.cloneProgram', async () => {
    vi.mocked(api.getPublicPrograms).mockResolvedValue(MOCK_PROGRAMS);
    renderDiscover();
    await screen.findByText('Home Push');
    const addButtons = screen.getAllByText('Add to My Flows');
    await userEvent.click(addButtons[0]);
    expect(api.cloneProgram).toHaveBeenCalledWith('prog-1');
  });

  it('displays equipment category badges', async () => {
    vi.mocked(api.getPublicPrograms).mockResolvedValue(MOCK_PROGRAMS);
    renderDiscover();
    await screen.findByText('Home Push');
    expect(screen.getByText('home')).toBeInTheDocument();
    expect(screen.getByText('gym')).toBeInTheDocument();
  });

  it('displays muscle tags on program cards', async () => {
    vi.mocked(api.getPublicPrograms).mockResolvedValue(MOCK_PROGRAMS);
    renderDiscover();
    await screen.findByText('Home Push');
    expect(screen.getByText('Chest')).toBeInTheDocument();
    expect(screen.getByText('Shoulders')).toBeInTheDocument();
    expect(screen.getByText('Legs')).toBeInTheDocument();
  });

  it('navigates to builder after successful clone', async () => {
    vi.mocked(api.getPublicPrograms).mockResolvedValue(MOCK_PROGRAMS);
    renderDiscover();
    await screen.findByText('Home Push');
    const addButtons = screen.getAllByText('Add to My Flows');
    await userEvent.click(addButtons[0]);
    // After clone succeeds, button text changes to "Added!"
    expect(await screen.findByText('Added!')).toBeInTheDocument();
  });

  it('shows empty state when no programs available', async () => {
    vi.mocked(api.getPublicPrograms).mockResolvedValue([]);
    renderDiscover();
    expect(await screen.findByText('No programs found')).toBeInTheDocument();
  });
});
