import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthToken } from '../../services/tokenStorage';
import { AuthGuard } from './AuthGuard';

vi.mock('../../services/tokenStorage', () => ({
  getAuthToken: vi.fn(),
}));

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<AuthGuard />}>
          <Route path="/" element={<div>Protected Home</div>} />
        </Route>
        <Route path="/login" element={<div>Login Screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.mocked(getAuthToken).mockReset();
  });

  it('renders the protected content when a token is stored', async () => {
    vi.mocked(getAuthToken).mockResolvedValue('signed.jwt.token');

    renderGuard();

    expect(await screen.findByText('Protected Home')).toBeInTheDocument();
  });

  it('redirects to /login when no token is stored', async () => {
    vi.mocked(getAuthToken).mockResolvedValue(null);

    renderGuard();

    expect(await screen.findByText('Login Screen')).toBeInTheDocument();
  });

  it('shows a loading state while the token check is pending', () => {
    vi.mocked(getAuthToken).mockReturnValue(new Promise(() => {}));

    renderGuard();

    expect(
      screen.getByRole('status', { name: /checking session/i }),
    ).toBeInTheDocument();
  });
});
