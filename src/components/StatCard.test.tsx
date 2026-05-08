import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatCard from './StatCard';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Total productos" value={42} />);

    expect(screen.getByText('Total productos')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders without emphasis by default', () => {
    render(<StatCard label="Categorías activas" value={7} />);

    const value = screen.getByText('7');
    expect(value).not.toHaveClass('text-orange-500');
    expect(value).not.toHaveClass('text-red-500');
  });

  it('applies orange emphasis class when emphasis is "orange"', () => {
    render(<StatCard label="Stock bajo" value={3} emphasis="orange" />);

    const value = screen.getByText('3');
    expect(value).toHaveClass('text-orange-500');
  });

  it('applies red emphasis class when emphasis is "red"', () => {
    render(<StatCard label="Crítico" value={1} emphasis="red" />);

    const value = screen.getByText('1');
    expect(value).toHaveClass('text-red-500');
  });
});
