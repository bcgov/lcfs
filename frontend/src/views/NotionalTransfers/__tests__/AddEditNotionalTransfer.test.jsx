import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { AddEditNotionalTransfers } from '../AddEditNotionalTransfers';
import * as useNotionalTransfer from '@/hooks/useNotionalTransfer';
import { wrapper } from '@/tests/utils/wrapper';

vi.mock('@react-keycloak/web', () => ({
  ReactKeycloakProvider: ({ children }) => children,
  useKeycloak: () => ({
    keycloak: {
      authenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    },
    initialized: true,
  }),
}));

// Mock react-router-dom
const mockUseParams = vi.fn();
const mockUseLocation = vi.fn(() => ({
  state: { message: 'Test message', severity: 'info' },
}));
const mockUseNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  ...vi.importActual('react-router-dom'),
  useParams: () => ({
    complianceReportId: '123',
    compliancePeriod: '2023',
  }),
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockUseNavigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

vi.mock('@/hooks/useNotionalTransfer', () => ({
    useNotionalTransferOptions: vi.fn(() => ({
      data: {
        fuelCategories: [
          {
            fuelCategoryId: 1,
            category: "Gasoline",
            description: "Gasoline"
          },
          {
            fuelCategoryId: 2,
            category: "Diesel",
            description: "Diesel"
          },
          {
            fuelCategoryId: 3,
            category: "Jet fuel",
            description: "Jet fuel"
          }
        ],
        receivedOrTransferred: [
          "Received",
          "Transferred"
        ]
      },
      isLoading: false,
      isFetched: true,
    })),
    useGetAllNotionalTransfers: vi.fn(() => ({
      data: {
        notionalTransfers: []
      },
      isLoading: false,
    })),
    useSaveNotionalTransfer: vi.fn(() => ({
      mutateAsync: vi.fn(), // Properly mock mutateAsync
    })),
  }));

describe('AddEditNotionalTransfers', () => {
  beforeEach(() => {
  vi.resetAllMocks();

  vi.spyOn(useNotionalTransfer, 'useSaveNotionalTransfer').mockReturnValue({
    mutateAsync: vi.fn(), // Ensure mutateAsync is mocked
  });
});
  it('renders the component successfully', async () => {
    render(<AddEditNotionalTransfers />, { wrapper });

    await waitFor(() => {
      expect(
        screen.getByText(/Add new notional transfer(s)/i)
      ).toBeInTheDocument();
    });
  });

  it('shows an error for 0 quantity', async () => {
    render(<AddEditNotionalTransfers />, { wrapper });

    const quantityInput = screen.getByLabelText(/quantity/i);
    fireEvent.change(quantityInput, { target: { value: '0' } });
    fireEvent.blur(quantityInput);

    await waitFor(() => {
      expect(screen.getByText(/quantity must be greater than 0./i)).toBeInTheDocument();
    });
  });

  it('shows an error for empty quantity', async () => {
    render(<AddEditNotionalTransfers />, { wrapper });

    const quantityInput = screen.getByLabelText(/quantity/i);
    fireEvent.change(quantityInput, { target: { value: '' } });
    fireEvent.blur(quantityInput);

    await waitFor(() => {
      expect(screen.getByText(/quantity must be greater than 0./i)).toBeInTheDocument();
    });
  });

  it('does not show an error for a valid quantity', async () => {
    render(<AddEditNotionalTransfers />, { wrapper });

    const quantityInput = screen.getByLabelText(/quantity/i);
    fireEvent.change(quantityInput, { target: { value: '10' } });
    fireEvent.blur(quantityInput);

    await waitFor(() => {
      expect(screen.queryByText(/quantity must be greater than 0./i)).not.toBeInTheDocument();
    });
  });
});
