import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageHeader } from './PageHeader';

const mockBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ back: mockBack })),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe('PageHeader', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the title', () => {
    render(<PageHeader breadcrumbs={[]} title="Mi Despensa" />);
    expect(screen.getByRole('heading', { name: 'Mi Despensa' })).toBeInTheDocument();
  });

  it('renders breadcrumbs without links when href is absent', () => {
    render(
      <PageHeader
        breadcrumbs={[{ label: 'Inicio' }, { label: 'Productos' }]}
        title="Productos"
      />,
    );
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('Productos', { selector: 'span' })).toBeInTheDocument();
  });

  it('renders breadcrumb as a link when href is provided', () => {
    render(
      <PageHeader
        breadcrumbs={[{ label: 'Inicio', href: '/' }]}
        title="Productos"
      />,
    );
    const link = screen.getByRole('link', { name: 'Inicio' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });

  it('renders the close button', () => {
    render(<PageHeader breadcrumbs={[]} title="Test" />);
    expect(screen.getByRole('button', { name: /cerrar/i })).toBeInTheDocument();
  });

  it('clicking the close button calls router.back()', () => {
    render(<PageHeader breadcrumbs={[]} title="Test" />);
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
