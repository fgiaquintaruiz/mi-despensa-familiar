import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LogoutButton from './LogoutButton';

vi.mock('../actions', () => ({
  logoutAction: vi.fn().mockResolvedValue(undefined),
}));

import { logoutAction } from '../actions';

describe('LogoutButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders with "Cerrar sesión" text', () => {
    render(<LogoutButton />);
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument();
  });

  it('disables the button while logoutAction is in flight', async () => {
    vi.mocked(logoutAction).mockReturnValue(new Promise(() => {}));
    render(<LogoutButton />);
    const btn = screen.getByRole('button', { name: /cerrar sesión/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saliendo/i })).toBeDisabled();
    });
  });
});
