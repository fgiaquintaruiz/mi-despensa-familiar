import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ManualTransactionForm from './ManualTransactionForm';

vi.mock('../actions', () => ({
  createManualTransactionAction: vi.fn().mockResolvedValue({}),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useActionState: (action: unknown, initialState: unknown) => [initialState, action, false],
  };
});

describe('ManualTransactionForm — tag segmented control (FEAT-3 Fase A)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the four tag buttons', () => {
    render(<ManualTransactionForm />);

    expect(screen.getByRole('button', { name: /mensual/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /semanal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /diaria/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /imprevisto/i })).toBeInTheDocument();
  });

  it('defaults to "diaria" tag', () => {
    render(<ManualTransactionForm />);

    const hidden = document.querySelector('input[name="tag"]') as HTMLInputElement;
    expect(hidden).not.toBeNull();
    expect(hidden.value).toBe('diaria');
  });

  it('marks the default "diaria" button as selected (aria-pressed=true)', () => {
    render(<ManualTransactionForm />);

    const diaria = screen.getByRole('button', { name: /diaria/i });
    expect(diaria.getAttribute('aria-pressed')).toBe('true');

    const mensual = screen.getByRole('button', { name: /mensual/i });
    expect(mensual.getAttribute('aria-pressed')).toBe('false');
  });

  it('updates the hidden input when a different tag is clicked', () => {
    render(<ManualTransactionForm />);

    const mensual = screen.getByRole('button', { name: /mensual/i });
    fireEvent.click(mensual);

    const hidden = document.querySelector('input[name="tag"]') as HTMLInputElement;
    expect(hidden.value).toBe('mensual');
    expect(mensual.getAttribute('aria-pressed')).toBe('true');

    const diaria = screen.getByRole('button', { name: /diaria/i });
    expect(diaria.getAttribute('aria-pressed')).toBe('false');
  });

  it('switches selection across all four tags', () => {
    render(<ManualTransactionForm />);

    const tags = ['mensual', 'semanal', 'diaria', 'imprevisto'] as const;
    const hidden = document.querySelector('input[name="tag"]') as HTMLInputElement;

    for (const t of tags) {
      const btn = screen.getByRole('button', { name: new RegExp(`^${t}$`, 'i') });
      fireEvent.click(btn);
      expect(hidden.value).toBe(t);
    }
  });
});

describe('ManualTransactionForm — base fields', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the amount input', () => {
    render(<ManualTransactionForm />);
    expect(screen.getByLabelText(/monto/i)).toBeInTheDocument();
  });

  it('renders the description input', () => {
    render(<ManualTransactionForm />);
    expect(screen.getByLabelText(/descripción/i)).toBeInTheDocument();
  });

  it('renders the date input', () => {
    render(<ManualTransactionForm />);
    expect(screen.getByLabelText(/fecha/i)).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    render(<ManualTransactionForm />);
    expect(screen.getByRole('button', { name: /registrar/i })).toBeInTheDocument();
  });
});
