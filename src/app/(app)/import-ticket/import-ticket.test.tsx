import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportTicketPage from './page';

vi.mock('../actions', () => ({
  importTicketItemsAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => ({ get: vi.fn().mockReturnValue(null) })),
}));

vi.mock('@/lib/openfoodfacts', () => ({
  lookupBrand: vi.fn().mockResolvedValue({}),
}));

const { importTicketItemsAction } = await import('../actions');
const { useRouter } = await import('next/navigation');

const MOCK_ITEMS = [
  { name: 'PAN H BRIOCHE', qty: 2, price: 1.1, category: 'despensa' },
  { name: 'CEBOLLA 2 KG', qty: 1, price: 3.9, category: 'frescos' },
];

function mockFetchSuccess() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ store: 'Mercadona', items: MOCK_ITEMS }),
    }),
  );
}

function mockFetchEmpty() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ store: 'Mercadona', items: [] }),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('ImportTicketPage', () => {
  it('renders the file input/upload button on initial render', () => {
    render(<ImportTicketPage />);
    expect(screen.getByText(/adjuntar ticket/i)).toBeInTheDocument();
  });

  it('shows item list after successful PDF upload', async () => {
    mockFetchSuccess();
    render(<ImportTicketPage />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf content'], 'mercadona.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    // Wait for the collapsed summary to appear
    await waitFor(() => {
      expect(screen.getByText('Importar todo')).toBeInTheDocument();
    });

    // Expand to see individual items
    fireEvent.click(screen.getByText('Ver y editar'));

    await waitFor(() => {
      expect(screen.getByText('PAN H BRIOCHE')).toBeInTheDocument();
      expect(screen.getByText('CEBOLLA 2 KG')).toBeInTheDocument();
    });
  });

  it('shows "Importar seleccionados" button when items are present', async () => {
    mockFetchSuccess();
    render(<ImportTicketPage />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf content'], 'mercadona.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    // Wait for collapsed view, then expand to see "Importar seleccionados"
    await waitFor(() => {
      expect(screen.getByText('Importar todo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ver y editar'));

    await waitFor(() => {
      expect(screen.getByText(/importar seleccionados/i)).toBeInTheDocument();
    });
  });

  it('shows no-detection message when API returns empty items', async () => {
    mockFetchEmpty();
    render(<ImportTicketPage />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf content'], 'mercadona.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(/no se detectaron productos/i),
      ).toBeInTheDocument();
    });
  });

  it('calls importTicketItemsAction and redirects on import', async () => {
    mockFetchSuccess();
    vi.mocked(importTicketItemsAction).mockResolvedValue({ imported: 2 });
    const mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);
    render(<ImportTicketPage />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf content'], 'mercadona.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    // Wait for collapsed view, then expand
    await waitFor(() => {
      expect(screen.getByText('Importar todo')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Ver y editar'));

    await waitFor(() => {
      expect(screen.getByText(/importar seleccionados/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/importar seleccionados/i));

    await waitFor(() => {
      expect(importTicketItemsAction).toHaveBeenCalledOnce();
      expect(mockPush).toHaveBeenCalledWith('/?imported=2');
    });
  });

  it('calls router.push after successful import', async () => {
    mockFetchSuccess();
    vi.mocked(importTicketItemsAction).mockResolvedValue({ imported: 2 });
    const mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);
    render(<ImportTicketPage />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf content'], 'mercadona.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    // Wait for collapsed view, then expand
    await waitFor(() => {
      expect(screen.getByText('Importar todo')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Ver y editar'));

    await waitFor(() => {
      expect(screen.getByText(/importar seleccionados/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/importar seleccionados/i));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/?imported=2');
    });
  });
});
