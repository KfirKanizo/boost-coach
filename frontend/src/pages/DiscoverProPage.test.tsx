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
    getExercises: vi.fn().mockResolvedValue([]),
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
    vi.mocked(api.getExercises).mockReset();
    vi.mocked(api.getExercises).mockResolvedValue([
      { id: 'ex-1', name_translations: { en: 'Push-ups' }, primary_muscle: 'chest', movement_pattern: 'push', equipment_required: 'bodyweight', boost_type: 'VISION_REP' },
      { id: 'ex-2', name_translations: { en: 'Squats' }, primary_muscle: 'quadriceps', movement_pattern: 'squat', equipment_required: 'bodyweight', boost_type: 'VISION_REP' },
    ]);
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
    // Click the "Home" filter button (first button with that name)
    const homeButtons = screen.getAllByRole('button', { name: /home/i });
    await userEvent.click(homeButtons[0]);
    expect(screen.getByText('Home Push')).toBeInTheDocument();
    expect(screen.queryByText('Gym Squat')).not.toBeInTheDocument();
  });

  it('opens preview modal when clicking a program card', async () => {
    vi.mocked(api.getPublicPrograms).mockResolvedValue(MOCK_PROGRAMS);
    renderDiscover();
    await screen.findByText('Home Push');
    // Click the Home Push card
    await userEvent.click(screen.getByText('Home Push'));
    // Modal should appear with exercise details
    expect(await screen.findByText('Push-ups')).toBeInTheDocument();
    expect(screen.getByText('3 sets')).toBeInTheDocument();
    expect(screen.getByText('10 reps')).toBeInTheDocument();
  });

  it('clone button in modal calls api.cloneProgram', async () => {
    vi.mocked(api.getPublicPrograms).mockResolvedValue(MOCK_PROGRAMS);
    renderDiscover();
    await screen.findByText('Home Push');
    // Open modal
    await userEvent.click(screen.getByText('Home Push'));
    // Click Add to My Flows inside modal
    const addButton = await screen.findByText('Add to My Flows');
    await userEvent.click(addButton);
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
    // Open modal and clone
    await userEvent.click(screen.getByText('Home Push'));
    const addButton = await screen.findByText('Add to My Flows');
    await userEvent.click(addButton);
    // Clone was called
    expect(api.cloneProgram).toHaveBeenCalledWith('prog-1');
    // After clone succeeds, modal closes and navigates to builder
    expect(await screen.findByText('Builder Page')).toBeInTheDocument();
  });

  it('shows empty state when no programs available', async () => {
    vi.mocked(api.getPublicPrograms).mockResolvedValue([]);
    renderDiscover();
    expect(await screen.findByText('No programs found')).toBeInTheDocument();
  });

  it('shows description in preview modal', async () => {
    vi.mocked(api.getPublicPrograms).mockResolvedValue(MOCK_PROGRAMS);
    renderDiscover();
    await screen.findByText('Home Push');
    await userEvent.click(screen.getByText('Home Push'));
    // Description appears on card AND in modal — use getAllByText
    const descriptions = screen.getAllByText('Bodyweight push workout');
    expect(descriptions.length).toBeGreaterThanOrEqual(2);
  });

  it('can close preview modal', async () => {
    vi.mocked(api.getPublicPrograms).mockResolvedValue(MOCK_PROGRAMS);
    renderDiscover();
    await screen.findByText('Home Push');
    await userEvent.click(screen.getByText('Home Push'));
    await screen.findByText('Push-ups');
    // Close modal by clicking the backdrop (dialog overlay)
    const dialog = screen.getByRole('dialog');
    await userEvent.click(dialog);
    expect(screen.queryByText('Push-ups')).not.toBeInTheDocument();
  });
});
