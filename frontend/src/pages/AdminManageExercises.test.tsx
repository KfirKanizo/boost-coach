import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import type { AdminExercise } from '../api/client';
import { AdminManageExercises } from './AdminManageExercises';

vi.mock('../api/client', () => ({
  api: {
    getAdminExercises: vi.fn(),
    updateAdminExercise: vi.fn(),
  },
}));

function mockExercise(overrides: Partial<AdminExercise> = {}): AdminExercise {
  return {
    id: 'ex-001',
    name_translations: { en: 'Push-ups' },
    primary_muscle: 'chest',
    movement_pattern: 'push',
    equipment_required: 'bodyweight',
    boost_type: 'VISION_REP',
    animation_url: null,
    instructions: null,
    is_active: true,
    ...overrides,
  };
}

const SAMPLE: AdminExercise[] = [
  mockExercise({ id: 'ex-001', name_translations: { en: 'Push-ups' }, primary_muscle: 'chest', movement_pattern: 'push', equipment_required: 'bodyweight' }),
  mockExercise({ id: 'ex-002', name_translations: { en: 'Lunge' }, primary_muscle: 'quadriceps', movement_pattern: 'squat', equipment_required: 'bodyweight' }),
  mockExercise({ id: 'ex-003', name_translations: { en: 'Barbell Row' }, primary_muscle: 'back', movement_pattern: 'pull', equipment_required: 'barbell' }),
];

function renderExercises() {
  return render(
    <MemoryRouter initialEntries={['/admin/exercises']}>
      <Routes>
        <Route path="/admin/exercises" element={<AdminManageExercises />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminManageExercises', () => {
  beforeEach(() => {
    vi.mocked(api.getAdminExercises).mockReset();
    vi.mocked(api.updateAdminExercise).mockReset();
    vi.mocked(api.getAdminExercises).mockResolvedValue(SAMPLE);
  });

  it('loads and displays exercises', async () => {
    renderExercises();
    expect(await screen.findByText('Push-ups')).toBeInTheDocument();
    expect(screen.getByText('Lunge')).toBeInTheDocument();
    expect(screen.getByText('Barbell Row')).toBeInTheDocument();
    expect(screen.getByText('3 exercises total')).toBeInTheDocument();
  });

  it('filters by equipment (Home/Gym)', async () => {
    renderExercises();
    await screen.findByText('Push-ups');
    await userEvent.click(screen.getByRole('button', { name: /equipment: home/i }));
    expect(screen.getByText('Push-ups')).toBeInTheDocument();
    expect(screen.getByText('Lunge')).toBeInTheDocument();
    expect(screen.queryByText('Barbell Row')).not.toBeInTheDocument();
  });

  it('filters by movement pattern', async () => {
    renderExercises();
    await screen.findByText('Push-ups');
    await userEvent.click(screen.getByRole('button', { name: /pattern: push/i }));
    expect(screen.getByText('Push-ups')).toBeInTheDocument();
    expect(screen.queryByText('Lunge')).not.toBeInTheDocument();
  });

  it('filters by muscle group', async () => {
    renderExercises();
    await screen.findByText('Push-ups');
    await userEvent.click(screen.getByRole('button', { name: /muscle group: chest/i }));
    expect(screen.getByText('Push-ups')).toBeInTheDocument();
    expect(screen.queryByText('Lunge')).not.toBeInTheDocument();
    expect(screen.queryByText('Barbell Row')).not.toBeInTheDocument();
  });

  it('searches exercises by name', async () => {
    renderExercises();
    await screen.findByText('Push-ups');
    await userEvent.type(screen.getByPlaceholderText('Search exercises...'), 'lunge');
    expect(screen.getByText('Lunge')).toBeInTheDocument();
    expect(screen.queryByText('Push-ups')).not.toBeInTheDocument();
  });

  it('shows loading state', async () => {
    vi.mocked(api.getAdminExercises).mockReturnValue(new Promise(() => {}));
    renderExercises();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows error state', async () => {
    vi.mocked(api.getAdminExercises).mockRejectedValue(new Error('Forbidden'));
    renderExercises();
    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
  });

  it('back button is present', async () => {
    renderExercises();
    expect(await screen.findByLabelText('Back to Admin')).toBeInTheDocument();
  });
});
