import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import type { PreBuiltProgram, AdminExercise } from '../api/client';
import { AdminManagePrograms } from './AdminManagePrograms';

vi.mock('../api/client', () => ({
  api: {
    getAdminPrograms: vi.fn(),
    getAdminExercises: vi.fn(),
    createAdminProgram: vi.fn(),
    updateAdminProgram: vi.fn(),
    deleteAdminProgram: vi.fn(),
  },
}));

function mockProgram(overrides: Partial<PreBuiltProgram> = {}): PreBuiltProgram {
  return {
    id: 'prog-1',
    title: 'Full Body Blast',
    description: 'A complete full body workout',
    muscle_tags: ['chest', 'back', 'legs'],
    exercises: [
      { exercise_id: 'ex-001', sets: 3, target_reps_or_duration: 10, rest_time_after_sec: 60 },
    ],
    is_active: true,
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

function renderPrograms() {
  return render(
    <MemoryRouter initialEntries={['/admin/programs']}>
      <Routes>
        <Route path="/admin/programs" element={<AdminManagePrograms />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminManagePrograms', () => {
  beforeEach(() => {
    vi.mocked(api.getAdminPrograms).mockReset();
    vi.mocked(api.getAdminExercises).mockReset();
    vi.mocked(api.deleteAdminProgram).mockReset();
    vi.mocked(api.getAdminPrograms).mockResolvedValue([mockProgram()]);
    vi.mocked(api.getAdminExercises).mockResolvedValue([mockExercise()]);
  });

  it('loads and displays programs', async () => {
    renderPrograms();
    expect(await screen.findByText('Full Body Blast')).toBeInTheDocument();
    expect(screen.getByText('A complete full body workout')).toBeInTheDocument();
    expect(screen.getByText('1 programs')).toBeInTheDocument();
  });

  it('shows empty state when no programs', async () => {
    vi.mocked(api.getAdminPrograms).mockResolvedValue([]);
    renderPrograms();
    expect(await screen.findByText('No programs yet')).toBeInTheDocument();
  });

  it('delete shows confirmation then deletes', async () => {
    vi.mocked(api.deleteAdminProgram).mockResolvedValue(undefined);
    vi.mocked(api.getAdminPrograms).mockResolvedValueOnce([mockProgram()]).mockResolvedValueOnce([]);
    renderPrograms();
    await screen.findByText('Full Body Blast');
    const deleteBtn = screen.getAllByRole('button', { name: /delete/i })[0];
    await userEvent.click(deleteBtn);
    const yesBtn = screen.getByText('Yes');
    await userEvent.click(yesBtn);
    expect(await vi.waitFor(() => {
      expect(api.deleteAdminProgram).toHaveBeenCalledWith('prog-1');
    }));
  });

  it('new button shows form', async () => {
    renderPrograms();
    await screen.findByText('Full Body Blast');
    await userEvent.click(screen.getByText('New'));
    expect(screen.getByText('New Program')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Program title')).toBeInTheDocument();
  });

  it('shows loading state', async () => {
    vi.mocked(api.getAdminPrograms).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.getAdminExercises).mockReturnValue(new Promise(() => {}));
    renderPrograms();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows error state', async () => {
    vi.mocked(api.getAdminPrograms).mockRejectedValue(new Error('Server error'));
    renderPrograms();
    expect(await screen.findByText('Server error')).toBeInTheDocument();
  });

  it('back button is present', async () => {
    renderPrograms();
    expect(await screen.findByLabelText('Back to Admin')).toBeInTheDocument();
  });
});
