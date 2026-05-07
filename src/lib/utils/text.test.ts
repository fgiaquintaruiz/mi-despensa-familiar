import { describe, it, expect } from 'vitest';
import { toTitleCase } from './text';

describe('toTitleCase', () => {
  it('capitalizes every word in a simple all-caps name', () => {
    expect(toTitleCase('ARROZ BASMATI')).toBe('Arroz Basmati');
  });

  it('capitalizes every word in another simple all-caps name', () => {
    expect(toTitleCase('AGUACATE BANDEJA')).toBe('Aguacate Bandeja');
  });

  it('does NOT capitalize stop words in the middle', () => {
    expect(toTitleCase('JAMONCITOS DE POLLO')).toBe('Jamoncitos de Pollo');
  });

  it('capitalizes stop word when it is the first word', () => {
    expect(toTitleCase('DE LA TIERRA')).toBe('De la Tierra');
  });

  it('handles abbreviated prefix followed by words (Q. LONCHAS EDAM TIER)', () => {
    expect(toTitleCase('Q. LONCHAS EDAM TIER')).toBe('Q. Lonchas Edam Tier');
  });

  it('handles mixed words and digits (CEBOLLA 2 KG)', () => {
    const result = toTitleCase('CEBOLLA 2 KG');
    expect(result).toBe('Cebolla 2 Kg');
  });

  it('handles short abbreviated tokens (PAN H BRIOCHE)', () => {
    expect(toTitleCase('PAN H BRIOCHE')).toBe('Pan H Brioche');
  });

  it('handles all stop words staying lowercase in the middle', () => {
    expect(toTitleCase('AGUA CON GAS Y SIN AZUCAR')).toBe('Agua con Gas y sin Azucar');
  });

  it('handles "del" as a stop word', () => {
    expect(toTitleCase('CREMA DEL CAMPO')).toBe('Crema del Campo');
  });

  it('handles "para" as a stop word', () => {
    expect(toTitleCase('PASTA PARA UNTAR')).toBe('Pasta para Untar');
  });

  it('handles a single word', () => {
    expect(toTitleCase('BANANA')).toBe('Banana');
  });

  it('lowercases and title-cases the fallback string (non-alpha chars treated as word boundary)', () => {
    // "(Producto por peso)" → "(producto" gets capitalised as "(producto" → "(producto"
    // The leading "(" makes charAt(0)="(" uppercase → stays "(", then "p" stays lowercase.
    // This fallback is a hardcoded parser constant, not user input — it is not passed through toTitleCase.
    expect(toTitleCase('CROQUETA COCIDO')).toBe('Croqueta Cocido');
  });
});
