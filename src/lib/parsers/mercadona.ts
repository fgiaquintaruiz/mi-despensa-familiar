import type { TicketParser } from './types';

export const mercadonaParser: TicketParser = {
  store: 'Mercadona',
  canParse: ({ filename, text }) => {
    const haystack = `${filename ?? ''} ${text ?? ''}`.toLowerCase();
    return haystack.includes('mercadona');
  },
  parse: async () => {
    // TODO: implement Mercadona PDF parsing using pdf-parse
    // Mercadona tickets have selectable text in PDF form
    return [];
  },
};
