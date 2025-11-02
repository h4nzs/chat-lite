import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import { useAuthStore } from '@store/auth';
import { api } from '@lib/api';

// Mock the entire api module
vi.mock('@lib/api', () => ({
  api: vi.fn(),
}));

// Mock the auth store
const mockLogin = vi.fn();
useAuthStore.setState({ login: mockLogin });

describe('Login Page', () => {
  beforeEach(() => {
    // Clear mocks before each test
    vi.mocked(api).mockClear();
    mockLogin.mockClear();
  });

  const renderComponent = () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
  };

  it('should render the login form correctly', () => {
    renderComponent();
    expect(screen.getByPlaceholderText(/email or username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('should call the login function from the store on form submission', async () => {
    renderComponent();

    const emailInput = screen.getByPlaceholderText(/email or username/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const loginButton = screen.getByRole('button', { name: /login/i });

    // Simulate user input
    fireEvent.change(emailInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    // Simulate form submission
    fireEvent.click(loginButton);

    // Wait for the login function to be called
    await waitFor(() => {
      expect(useAuthStore.getState().login).toHaveBeenCalledWith('testuser', 'password123');
    });
  });

  it('should show an error message on failed login', async () => {
    // Mock a failed login attempt
    const errorMessage = 'Invalid credentials';
    mockLogin.mockRejectedValue(new Error(errorMessage));

    renderComponent();

    // Simulate user input and submission
    fireEvent.change(screen.getByPlaceholderText(/email or username/i), { target: { value: 'wrong' } });
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'user' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    // Wait for the error message to appear
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });
});
