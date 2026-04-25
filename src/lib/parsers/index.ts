import type { TicketParser } from './types';
import { mercadonaParser } from './mercadona';

export const parsers: TicketParser[] = [
  mercadonaParser,
  // TODO: carrefour, aldi, eroski parsers
];

export const findParser = (input: { filename?: string; text?: string }): TicketParser | undefined =>
  parsers.find((p) => p.canParse(input));
