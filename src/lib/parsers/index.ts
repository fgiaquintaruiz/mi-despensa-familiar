import type { TicketParser } from './types';
import { mercadonaParser } from './mercadona';
import { carrefourParser } from './carrefour';

export const parsers: TicketParser[] = [
  mercadonaParser,
  carrefourParser,
  // TODO: aldi, eroski parsers
];

export const findParser = (input: { filename?: string; text?: string }): TicketParser | undefined =>
  parsers.find((p) => p.canParse(input));
