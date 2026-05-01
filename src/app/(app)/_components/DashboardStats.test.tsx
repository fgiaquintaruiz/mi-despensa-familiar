import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardStats from './DashboardStats';

describe('DashboardStats', () => {
  it('renders the total product count', () => {
    render(<DashboardStats total={42} lowStock={3} categories={4} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders the low stock count', () => {
    render(<DashboardStats total={42} lowStock={3} categories={4} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders the active categories count', () => {
    render(<DashboardStats total={42} lowStock={3} categories={4} />);
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});
