import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportTicketPage from './page';

vi.mock('../actions', () => ({
  importTicketItemsAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
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
    expect(screen.getByText(/seleccionar ticket pdf/i)).toBeInTheDocument();
  });

  it('shows item list after successful PDF upload', async () => {
    mockFetchSuccess();
    render(<ImportTicketPage />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf content'], 'mercadona.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

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

  it('calls importTicketItemsAction and shows success message on import', async () => {
    mockFetchSuccess();
    vi.mocked(importTicketItemsAction).mockResolvedValue({ imported: 2 });
    render(<ImportTicketPage />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf content'], 'mercadona.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => screen.getByText(/importar seleccionados/i));
    fireEvent.click(screen.getByText(/importar seleccionados/i));

    await waitFor(() => {
      expect(importTicketItemsAction).toHaveBeenCalledOnce();
      expect(screen.getByText(/2 productos importados/i)).toBeInTheDocument();
    });
  });

  it('shows "Volver al dashboard" button after successful import', async () => {
    mockFetchSuccess();
    vi.mocked(importTicketItemsAction).mockResolvedValue({ imported: 2 });
    const mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>);
    render(<ImportTicketPage />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf content'], 'mercadona.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => screen.getByText(/importar seleccionados/i));
    fireEvent.click(screen.getByText(/importar seleccionados/i));

    await waitFor(() => screen.getByText(/volver al dashboard/i));
    fireEvent.click(screen.getByText(/volver al dashboard/i));
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
