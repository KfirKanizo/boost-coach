import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

vi.mock('@capgo/capacitor-social-login', () => ({
  SocialLogin: {
    initialize: vi.fn().mockResolvedValue(undefined),
    login: vi.fn(),
  },
}));

vi.mock('../api/client', () => ({
  api: {
    login: vi.fn(),
    register: vi.fn(),
    googleLogin: vi.fn(),
  },
}));

import { LoginPage } from './LoginPage';
import { SocialLogin } from '@capgo/capacitor-social-login';

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>The Flow</div>} />
        <Route path="/onboarding" element={<div>Onboarding</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const SUCCESS = { access_token: 'signed.jwt.token', token_type: 'bearer' };

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(api.login).mockReset();
    vi.mocked(api.register).mockReset();
    vi.mocked(api.googleLogin).mockReset();
    vi.mocked(SocialLogin.login).mockReset();
  });

  it('Google button (web fallback) calls login with seeded email', async () => {
    vi.mocked(api.login).mockResolvedValue(SUCCESS);
    renderLogin();

    await userEvent.click(
      screen.getByRole('button', { name: /continue with google/i }),
    );

    expect(api.login).toHaveBeenCalledWith('test@boostcoach.fit');
    expect(await screen.findByText('The Flow')).toBeInTheDocument();
  });

  it('Apple button calls login with mock email', async () => {
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

  it('registers a new account and navigates to onboarding', async () => {
    vi.mocked(api.register).mockResolvedValue({ id: 'u-2', email: 'new@test.com' });
    vi.mocked(api.login).mockResolvedValue(SUCCESS);
    renderLogin();

    await userEvent.click(screen.getByText("Don't have an account? Create one"));

    await userEvent.type(screen.getByPlaceholderText(/email/i), 'new@test.com');
    await userEvent.type(screen.getByPlaceholderText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(api.register).toHaveBeenCalledWith('new@test.com', 'password123');
    expect(api.login).toHaveBeenCalledWith('new@test.com');
    expect(await screen.findByText('Onboarding')).toBeInTheDocument();
  });

  it('signs in with email/password and lands on The Flow', async () => {
    vi.mocked(api.login).mockResolvedValue(SUCCESS);
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText(/email/i), 'user@test.com');
    await userEvent.type(screen.getByPlaceholderText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in$/i }));

    expect(api.login).toHaveBeenCalledWith('user@test.com');
    expect(await screen.findByText('The Flow')).toBeInTheDocument();
  });
});
