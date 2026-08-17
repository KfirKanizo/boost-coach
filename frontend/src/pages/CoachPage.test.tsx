import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import type { CoachChatResponse, UserProfile } from '../api/client';
import { CoachPage } from './CoachPage';

vi.mock('../api/client', () => ({
  api: {
    sendCoachChat: vi.fn(),
    getUserProfile: vi.fn(),
    updateUserProfile: vi.fn(),
  },
}));

// jsdom doesn't implement scrollTo on elements.
Element.prototype.scrollTo = vi.fn();

function chatReply(overrides: Partial<CoachChatResponse> = {}): CoachChatResponse {
  return {
    reply: 'Great question! Stay consistent and you will see results.',
    is_fallback: false,
    ...overrides,
  };
}

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u-1',
    email: 'test@boostcoach.fit',
    gender: null,
    age: null,
    weight: 70,
    height: 175,
    current_streak: 3,
    fitness_goals: null,
    fitness_styles: null,
    ...overrides,
  };
}

describe('CoachPage', () => {
  beforeEach(() => {
    vi.mocked(api.sendCoachChat).mockReset();
    vi.mocked(api.getUserProfile).mockReset();
    vi.mocked(api.updateUserProfile).mockReset();
    vi.mocked(api.getUserProfile).mockResolvedValue(profile());
  });

  it('shows the typing indicator, then the coach reply', async () => {
    let resolveApi!: (value: CoachChatResponse) => void;
    vi.mocked(api.sendCoachChat).mockReturnValue(
      new Promise<CoachChatResponse>((resolve) => {
        resolveApi = resolve;
      }),
    );

    render(<CoachPage />);

    const input = screen.getByRole('textbox', { name: /message the coach/i });
    await userEvent.type(input, 'How do I improve my squat?');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(screen.getByText('How do I improve my squat?')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /coach is typing/i })).toBeInTheDocument();

    resolveApi(chatReply());
    expect(
      await screen.findByText(/great question/i),
    ).toBeInTheDocument();
    expect(screen.getByText('BoostCoach AI')).toBeInTheDocument();
  });

  it('labels the response as local when the backend fell back', async () => {
    vi.mocked(api.sendCoachChat).mockResolvedValue(
      chatReply({
        reply: 'Keep going, you are doing great!',
        is_fallback: true,
      }),
    );

    render(<CoachPage />);

    const input = screen.getByRole('textbox', { name: /message the coach/i });
    await userEvent.type(input, 'Am I on track?');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(
      await screen.findByText(/keep going/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Local response')).toBeInTheDocument();
    expect(screen.queryByText('BoostCoach AI')).not.toBeInTheDocument();
  });

  it('surfaces an error and lets the user retry', async () => {
    vi.mocked(api.sendCoachChat)
      .mockRejectedValueOnce(new Error('The Coach is unavailable'))
      .mockResolvedValueOnce(chatReply());

    render(<CoachPage />);

    const input = screen.getByRole('textbox', { name: /message the coach/i });
    await userEvent.type(input, 'Hello coach!');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The Coach is unavailable',
    );

    await userEvent.type(input, 'Try again');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText(/great question/i)).toBeInTheDocument();
  });

  it('sends a message on Enter key', async () => {
    vi.mocked(api.sendCoachChat).mockResolvedValue(chatReply());

    render(<CoachPage />);

    const input = screen.getByRole('textbox', { name: /message the coach/i });
    await userEvent.type(input, 'Quick question{Enter}');

    expect(await screen.findByText('Quick question')).toBeInTheDocument();
    expect(api.sendCoachChat).toHaveBeenCalledWith('Quick question');
  });

  describe('progressive profiling', () => {
    it('does not prompt when the profile is complete', async () => {
      vi.mocked(api.getUserProfile).mockResolvedValue(profile());

      render(<CoachPage />);

      await screen.findByRole('textbox', { name: /message the coach/i });
      expect(
        screen.queryByText(/what is your current weight in kg/i),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/what is your height in cm/i)).not.toBeInTheDocument();
    });

    it('asks for the weight inside a coach bubble when it is missing', async () => {
      vi.mocked(api.getUserProfile).mockResolvedValue(
        profile({ weight: null }),
      );

      render(<CoachPage />);

      expect(
        await screen.findByText(
          /To accurately calculate your calorie burn, what is your current weight in kg/i,
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /weight in kg/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Save$/i })).toBeInTheDocument();
    });

    it('saves the weight, thanks the user, and removes the prompt', async () => {
      vi.mocked(api.getUserProfile).mockResolvedValue(
        profile({ weight: null }),
      );
      vi.mocked(api.updateUserProfile).mockResolvedValue(profile({ weight: 75 }));

      render(<CoachPage />);

      const input = await screen.findByRole('textbox', { name: /weight in kg/i });
      await userEvent.type(input, '75');
      await userEvent.click(screen.getByRole('button', { name: /^Save$/i }));

      expect(api.updateUserProfile).toHaveBeenCalledWith({ weight: 75 });
      expect(await screen.findByText('Thank you!')).toBeInTheDocument();
      expect(
        screen.queryByText(/what is your current weight in kg/i),
      ).not.toBeInTheDocument();
    });

    it('disables the Save button until a valid number is entered', async () => {
      vi.mocked(api.getUserProfile).mockResolvedValue(
        profile({ weight: null }),
      );

      render(<CoachPage />);

      const input = await screen.findByRole('textbox', { name: /weight in kg/i });
      const save = screen.getByRole('button', { name: /^Save$/i });
      expect(save).toBeDisabled();

      await userEvent.type(input, '0');
      expect(save).toBeDisabled();

      await userEvent.clear(input);
      await userEvent.type(input, '68.5');
      expect(save).toBeEnabled();
    });

    it('asks for the height next when only the height is missing', async () => {
      vi.mocked(api.getUserProfile).mockResolvedValue(
        profile({ weight: 70, height: null }),
      );

      render(<CoachPage />);

      expect(
        await screen.findByText(
          /To fine-tune your training plan, what is your height in cm/i,
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/what is your current weight in kg/i),
      ).not.toBeInTheDocument();
    });

    it('asks for the height after the weight is saved', async () => {
      vi.mocked(api.getUserProfile).mockResolvedValue(
        profile({ weight: null, height: null }),
      );
      vi.mocked(api.updateUserProfile).mockResolvedValue(
        profile({ weight: 75, height: null }),
      );

      render(<CoachPage />);

      const input = await screen.findByRole('textbox', { name: /weight in kg/i });
      await userEvent.type(input, '75');
      await userEvent.click(screen.getByRole('button', { name: /^Save$/i }));

      expect(await screen.findByText('Thank you!')).toBeInTheDocument();
      expect(
        await screen.findByText(/what is your height in cm/i),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/what is your current weight in kg/i),
      ).not.toBeInTheDocument();
    });
  });
});
