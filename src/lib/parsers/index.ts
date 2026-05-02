import type { TicketParser } from './types';
import { mercadonaParser } from './mercadona';
import { carrefourParser } from './carrefour';
import { aldiParser } from './aldi';

export const parsers: TicketParser[] = [
  mercadonaParser,
  carrefourParser,
  aldiParser,
  // TODO: eroski parser
];

export const findParser = (input: { filename?: string; text?: string }): TicketParser | undefined =>
  parsers.find((p) => p.canParse(input));
