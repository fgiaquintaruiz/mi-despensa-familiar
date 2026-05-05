import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import OnboardingForm from './onboarding-form';

vi.mock('./actions', () => ({
  createHouseholdAction: vi.fn().mockResolvedValue(undefined),
}));

// Mutable ref so each test can control pending and state independently
const mockUseActionState = vi.hoisted(() =>
  vi.fn().mockReturnValue([undefined, vi.fn(), false]),
);

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useActionState: mockUseActionState,
  };
});

describe('OnboardingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActionState.mockReturnValue([undefined, vi.fn(), false]);
  });

  it('renders the household name input', () => {
    render(<OnboardingForm />);
    expect(screen.getByLabelText(/nombre del hogar/i)).toBeInTheDocument();
  });

  it('renders the submit button in idle state', () => {
    render(<OnboardingForm />);
    expect(screen.getByRole('button', { name: /crear hogar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear hogar/i })).not.toBeDisabled();
  });

  it('shows "Creando hogar…" and disables the button while pending', () => {
    mockUseActionState.mockReturnValue([undefined, vi.fn(), true]);
    render(<OnboardingForm />);
    const btn = screen.getByRole('button', { name: /creando hogar/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
  });

  it('shows the error message when state.error is set', () => {
    mockUseActionState.mockReturnValue([
      { error: 'Ponele un nombre a tu hogar.' },
      vi.fn(),
      false,
    ]);
    render(<OnboardingForm />);
    expect(screen.getByRole('alert')).toHaveTextContent('Ponele un nombre a tu hogar.');
  });

  it('does not render an alert when state is undefined', () => {
    render(<OnboardingForm />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('the input has aria-describedby pointing to the error element when error is present', () => {
    mockUseActionState.mockReturnValue([
      { error: 'Datos inválidos.' },
      vi.fn(),
      false,
    ]);
    render(<OnboardingForm />);
    const input = screen.getByLabelText(/nombre del hogar/i);
    expect(input).toHaveAttribute('aria-describedby', 'form-error');
  });

  it('the input has no aria-describedby when there is no error', () => {
    render(<OnboardingForm />);
    const input = screen.getByLabelText(/nombre del hogar/i);
    expect(input).not.toHaveAttribute('aria-describedby');
  });
});
