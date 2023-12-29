import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Organizations } from './Organizations';

vi.mock('@/services/useApiService', () => ({
  useApiService: () => ({
    download: vi.fn().mockResolvedValueOnce()
  })
}));

const renderComponent = () => {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <Router>
        <Organizations />
      </Router>
    </QueryClientProvider>
  );
};

describe('Organizations Component Tests', () => {
  beforeEach(() => {
    renderComponent();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('initially shows the download button with correct text and enabled', () => {
    const downloadButton = screen.getByRole('button', { name: /Download Organization Information/i });
    expect(downloadButton).toBeInTheDocument();
    expect(downloadButton).toBeEnabled();
  });

  it('shows downloading text and disables the button during download', async () => {
    const downloadButton = screen.getByRole('button', { name: /Download Organization Information/i });
    fireEvent.click(downloadButton);

    // Wait for the download operation to complete and the component state to update
    await waitFor(() => {
        expect(downloadButton).toHaveTextContent(/Downloading Organization Information.../i);
        expect(downloadButton).toBeDisabled();
    });
  });
});
