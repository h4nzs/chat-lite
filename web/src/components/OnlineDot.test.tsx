import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import OnlineDot from './OnlineDot';

describe('OnlineDot', () => {
  it('should render a green dot and label when online is true', () => {
    render(<OnlineDot online={true} />);
    const dot = screen.getByLabelText('Online');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('bg-green-500');
  });

  it('should render a gray dot and label when online is false', () => {
    render(<OnlineDot online={false} />);
    const dot = screen.getByLabelText('Offline');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('bg-gray-400');
  });
});
