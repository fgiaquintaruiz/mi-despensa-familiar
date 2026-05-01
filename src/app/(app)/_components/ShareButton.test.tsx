import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ShareButton from './ShareButton';

describe('ShareButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<ShareButton text="Test text" />);
    expect(screen.getByText(/compartir lista/i)).toBeInTheDocument();
  });

  it('uses navigator.share if available', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share: shareMock });

    render(<ShareButton text="Test text" />);
    fireEvent.click(screen.getByText(/compartir lista/i));

    expect(shareMock).toHaveBeenCalledWith({
      title: 'Lista de la Compra - Mi Despensa Familiar',
      text: 'Test text',
    });
  });

  it('falls back to clipboard if navigator.share is not available', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: { writeText: writeTextMock },
    });

    render(<ShareButton text="Test text" />);
    fireEvent.click(screen.getByText(/compartir lista/i));

    expect(writeTextMock).toHaveBeenCalledWith('Test text');
    expect(await screen.findByText(/¡copiado!/i)).toBeInTheDocument();
  });
});
