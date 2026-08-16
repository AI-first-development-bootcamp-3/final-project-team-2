import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the app shell with home dashboard by default', () => {
    render(<App />);
    expect(screen.getByText('עמוד ראשי - דיווח יומי')).toBeInTheDocument();
  });
});
