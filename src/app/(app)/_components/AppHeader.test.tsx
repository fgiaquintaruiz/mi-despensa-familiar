import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import AppHeader from './AppHeader';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  usePathname: vi.fn().mockReturnValue('/'),
  useRouter: vi.fn().mockReturnValue({ back: vi.fn() }),
  useSearchParams: vi.fn().mockReturnValue(new URLSearchParams()),
}));

// next/link renders an <a> in test environment — no mock needed.
// Mock child components that have their own complex dependencies.
vi.mock('./LogoutButton', () => ({
  default: () => <button>Cerrar sesión</button>,
}));

vi.mock('@/components/NotificationPermission', () => ({
  default: () => <button>Activar notificaciones</button>,
}));

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AppHeader', () => {
  beforeEach(() => vi.clearAllMocks());

  // -------------------------------------------------------------------------
  // 1. Static structure
  // -------------------------------------------------------------------------
  it('renders the "Mi Despensa" title', () => {
    render(<AppHeader />);
    expect(screen.getByRole('heading', { level: 1, name: /mi despensa/i })).toBeInTheDocument();
  });

  it('renders the version badge', () => {
    render(<AppHeader />);
    // package.json version is dynamic — just check the "v" prefix is present
    expect(screen.getByText(/^v\d/)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 2. Hamburger button — closed state
  // -------------------------------------------------------------------------
  it('renders the hamburger button with correct aria attributes when menu is closed', () => {
    render(<AppHeader />);
    const btn = screen.getByRole('button', { name: /abrir menú/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(btn).toHaveAttribute('aria-controls', 'app-menu');
  });

  // -------------------------------------------------------------------------
  // 3. Menu is closed by default
  // -------------------------------------------------------------------------
  it('does not show the dropdown menu on initial render', () => {
    render(<AppHeader />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 4. Toggle — open
  // -------------------------------------------------------------------------
  it('opens the dropdown menu when the hamburger button is clicked', () => {
    render(<AppHeader />);
    fireEvent.click(screen.getByRole('button', { name: /abrir menú/i }));
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('changes aria-label and aria-expanded when the menu opens', () => {
    render(<AppHeader />);
    fireEvent.click(screen.getByRole('button', { name: /abrir menú/i }));
    const btn = screen.getByRole('button', { name: /cerrar menú/i });
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });

  // -------------------------------------------------------------------------
  // 5. Toggle — close
  // -------------------------------------------------------------------------
  it('closes the dropdown menu when the button is clicked a second time', () => {
    render(<AppHeader />);
    const btn = screen.getByRole('button', { name: /abrir menú/i });
    fireEvent.click(btn); // open
    fireEvent.click(screen.getByRole('button', { name: /cerrar menú/i })); // close
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 6. Nav links — all rendered with correct hrefs
  // -------------------------------------------------------------------------
  it('renders all three nav links with correct hrefs when menu is open', () => {
    render(<AppHeader />);
    fireEvent.click(screen.getByRole('button', { name: /abrir menú/i }));

    const budgetLink = screen.getByRole('link', { name: /presupuesto/i });
    const statsLink = screen.getByRole('link', { name: /stats/i });
    const shoppingLink = screen.getByRole('link', { name: /lista compra/i });

    expect(budgetLink).toHaveAttribute('href', '/budget');
    expect(statsLink).toHaveAttribute('href', '/stats');
    expect(shoppingLink).toHaveAttribute('href', '/shopping-list');
  });

  // -------------------------------------------------------------------------
  // 7. Menu closes when a nav link is clicked
  // -------------------------------------------------------------------------
  it('closes the menu when a nav link is clicked', () => {
    render(<AppHeader />);
    fireEvent.click(screen.getByRole('button', { name: /abrir menú/i }));

    // Click any nav link — each calls setOpen(false) via onClick prop
    fireEvent.click(screen.getByRole('link', { name: /presupuesto/i }));

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 8. Dropdown contains LogoutButton and NotificationPermission
  // -------------------------------------------------------------------------
  it('renders LogoutButton and NotificationPermission inside the open menu', () => {
    render(<AppHeader />);
    fireEvent.click(screen.getByRole('button', { name: /abrir menú/i }));

    // LogoutButton mock renders "Cerrar sesión", NotificationPermission mock renders "Activar notificaciones"
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /activar notificaciones/i })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 9. Dropdown has correct id for aria-controls
  // -------------------------------------------------------------------------
  it('dropdown has the id referenced by aria-controls', () => {
    render(<AppHeader />);
    fireEvent.click(screen.getByRole('button', { name: /abrir menú/i }));

    expect(document.getElementById('app-menu')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 10. Back button — only shown when not on root path
  // -------------------------------------------------------------------------
  it('shows back button when not on root path', () => {
    vi.mocked(usePathname).mockReturnValue('/budget');
    render(<AppHeader />);
    expect(screen.getByRole('button', { name: /volver/i })).toBeInTheDocument();
  });

  it('does not show back button on root path', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    render(<AppHeader />);
    expect(screen.queryByRole('button', { name: /volver/i })).not.toBeInTheDocument();
  });
});
