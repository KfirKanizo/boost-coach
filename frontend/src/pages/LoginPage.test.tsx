import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { LoginPage } from './LoginPage';

vi.mock('../api/client', () => ({
  api: { login: vi.fn() },
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>The Flow</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const SUCCESS = { access_token: 'signed.jwt.token', token_type: 'bearer' };

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(api.login).mockReset();
  });

  it('signs in with the seeded user on Google and lands on The Flow', async () => {
    vi.mocked(api.login).mockResolvedValue(SUCCESS);
    renderLogin();

    await userEvent.click(
      screen.getByRole('button', { name: /continue with google/i }),
    );

    expect(api.login).toHaveBeenCalledWith('test@boostcoach.fit');
    expect(await screen.findByText('The Flow')).toBeInTheDocument();
  });

  it('signs in with the seeded user on Apple', async () => {
    vi.mocked(api.login).mockResolvedValue(SUCCESS);
    renderLogin();

    await userEvent.click(
      screen.getByRole('button', { name: /continue with apple/i }),
    );

    expect(api.login).toHaveBeenCalledWith('test@boostcoach.fit');
    expect(await screen.findByText('The Flow')).toBeInTheDocument();
  });

  it('disables both buttons and shows a spinner while authenticating', async () => {
    let resolveLogin!: (value: typeof SUCCESS) => void;
    vi.mocked(api.login).mockReturnValue(
      new Promise<typeof SUCCESS>((resolve) => {
        resolveLogin = resolve;
      }),
    );
    renderLogin();

    const google = screen.getByRole('button', { name: /continue with google/i });
    const apple = screen.getByRole('button', { name: /continue with apple/i });

    await userEvent.click(google);

    expect(google).toBeDisabled();
    expect(apple).toBeDisabled();
    expect(screen.getByRole('status', { name: /signing in/i })).toBeInTheDocument();
    expect(api.login).toHaveBeenCalledTimes(1);

    resolveLogin(SUCCESS);
    expect(await screen.findByText('The Flow')).toBeInTheDocument();
  });

  it('shows an error and re-enables the buttons when sign-in fails', async () => {
    vi.mocked(api.login).mockRejectedValue(new Error('network down'));
    renderLogin();

    await userEvent.click(
      screen.getByRole('button', { name: /continue with google/i }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /sign-in failed/i,
    );
    expect(
      screen.getByRole('button', { name: /continue with google/i }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /continue with apple/i }),
    ).toBeEnabled();
  });
});
