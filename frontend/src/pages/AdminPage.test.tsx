import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import type { AdminStats, AdminExercise } from '../api/client';
import { AdminPage } from './AdminPage';

vi.mock('../api/client', () => ({
  api: {
    getAdminStats: vi.fn(),
    getAdminExercises: vi.fn(),
    updateAdminExercise: vi.fn(),
  },
}));

function mockStats(overrides: Partial<AdminStats> = {}): AdminStats {
  return {
    total_users: 42,
    total_workouts: 150,
    total_exercises: 20,
    ...overrides,
  };
}

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

function renderAdmin() {
  return render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>,
  );
}

describe('AdminPage', () => {
  beforeEach(() => {
    vi.mocked(api.getAdminStats).mockReset();
    vi.mocked(api.getAdminExercises).mockReset();
    vi.mocked(api.updateAdminExercise).mockReset();
    vi.mocked(api.getAdminStats).mockResolvedValue(mockStats());
    vi.mocked(api.getAdminExercises).mockResolvedValue([
      mockExercise(),
      mockExercise({ id: 'ex-002', name_translations: { en: 'Squat' }, movement_pattern: 'squat', is_active: false }),
    ]);
  });

  it('renders the system overview stats', async () => {
    renderAdmin();

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Workouts')).toBeInTheDocument();
    expect(screen.getByText('Exercises')).toBeInTheDocument();
  });

  it('renders the exercise list', async () => {
    renderAdmin();

    expect(await screen.findByText('Push-ups')).toBeInTheDocument();
    expect(screen.getByText('Squat')).toBeInTheDocument();
  });

  it('shows inactive badge for deactivated exercises', async () => {
    renderAdmin();

    await screen.findByText('Squat');
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('enters edit mode when pencil is clicked', async () => {
    renderAdmin();

    await screen.findByText('Push-ups');

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    await userEvent.click(editButtons[0]);

    // Should now show movement pattern chips and Save/Cancel buttons
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });

  it('saves exercise changes on Save click', async () => {
    vi.mocked(api.updateAdminExercise).mockResolvedValue(mockExercise({ movement_pattern: 'pull' }));

    renderAdmin();

    await screen.findByText('Push-ups');

    // Enter edit mode
    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    await userEvent.click(editButtons[0]);

    // Click a different movement pattern
    await userEvent.click(screen.getByRole('button', { name: /^pull$/i }));

    // Save
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(api.updateAdminExercise).toHaveBeenCalledWith('ex-001', {
        movement_pattern: 'pull',
        is_active: true,
      });
    });
  });

  it('shows error state when fetch fails', async () => {
    vi.mocked(api.getAdminStats).mockRejectedValue(new Error('Forbidden'));

    renderAdmin();

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
  });

  it('shows empty state when no exercises exist', async () => {
    vi.mocked(api.getAdminExercises).mockResolvedValue([]);

    renderAdmin();

    await screen.findByText('System Overview');
    expect(screen.getByText('No exercises found.')).toBeInTheDocument();
  });
});
