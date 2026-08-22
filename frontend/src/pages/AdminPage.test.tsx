import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import type { AdminStats } from '../api/client';
import { AdminPage } from './AdminPage';

vi.mock('../api/client', () => ({
  api: {
    getAdminStats: vi.fn(),
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

function renderAdmin() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/exercises" element={<div>Manage Exercises Page</div>} />
        <Route path="/admin/programs" element={<div>Manage Programs Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminPage', () => {
  beforeEach(() => {
    vi.mocked(api.getAdminStats).mockReset();
    vi.mocked(api.getAdminStats).mockResolvedValue(mockStats());
  });

  it('renders loading state initially', () => {
    vi.mocked(api.getAdminStats).mockReturnValue(new Promise(() => {}));
    renderAdmin();
    expect(screen.getByText(/loading admin data/i)).toBeInTheDocument();
  });

  it('renders the system overview stats after load', async () => {
    renderAdmin();
    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Workouts')).toBeInTheDocument();
    expect(screen.getByText('Exercises')).toBeInTheDocument();
  });

  it('renders the management action cards', async () => {
    renderAdmin();
    await screen.findByText('42');
    expect(screen.getByText('Manage Exercises')).toBeInTheDocument();
    expect(screen.getByText('Manage Pre-Built Programs')).toBeInTheDocument();
  });

  it('shows error state when stats fetch fails', async () => {
    vi.mocked(api.getAdminStats).mockRejectedValue(new Error('Forbidden'));
    renderAdmin();
    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
  });

  it('retry button reloads data', async () => {
    vi.mocked(api.getAdminStats).mockRejectedValueOnce(new Error('fail'));
    renderAdmin();
    await screen.findByRole('alert');
    vi.mocked(api.getAdminStats).mockResolvedValue(mockStats());
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('42')).toBeInTheDocument();
  });

  it('Manage Exercises card shows correct description', async () => {
    renderAdmin();
    await screen.findByText('Manage Exercises');
    expect(screen.getByText('View, filter, and edit exercise details')).toBeInTheDocument();
  });

  it('Manage Pre-Built Programs card shows correct description', async () => {
    renderAdmin();
    await screen.findByText('Manage Pre-Built Programs');
    expect(screen.getByText('Create and edit curated workout programs')).toBeInTheDocument();
  });
});
