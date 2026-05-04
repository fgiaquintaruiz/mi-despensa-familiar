import type { Category } from '@/lib/types';

export interface ParsedTicketItem {
  name: string;
  qty: number;
  unit: string;
  price: number;
  category: Category;
  brand?: string;
}

export interface TicketParser {
  store: string;
  canParse: (input: { filename?: string; text?: string }) => boolean;
  parse: (input: { buffer: Buffer; text?: string }) => Promise<ParsedTicketItem[]>;
}
