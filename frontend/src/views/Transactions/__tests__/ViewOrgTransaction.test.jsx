import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
import { useInitiativeAgreement } from '@/hooks/useInitiativeAgreement';
import { ViewOrgTransaction } from '@/views/Transactions/ViewOrgTransaction';

// Mock hooks and components
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        'txn:loadingText': 'Loading...'
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock('@/hooks/useInitiativeAgreement', () => ({
  useInitiativeAgreement: vi.fn(),
}));

vi.mock('@/views/Transactions/components', () => ({
  OrgTransactionDetails: vi.fn(() => <div>OrgTransactionDetails Component</div>)
}));

vi.mock('@/components/Loading', () => ({
  __esModule: true,
  default: ({ message }) => <div>{message}</div>,
}));

describe('ViewOrgTransaction Component', () => {
  const renderComponent = (route) => {
    render(
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/org-admin-adjustment/:transactionId" element={<ViewOrgTransaction />} />
          <Route path="/org-initiative-agreement/:transactionId" element={<ViewOrgTransaction />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders loading state correctly for initiative agreement', () => {
    useInitiativeAgreement.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    renderComponent('/org-initiative-agreement/1');

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });


  it('renders transaction details correctly for initiative agreement', () => {
    useInitiativeAgreement.mockReturnValue({
      data: { id: 1, type: 'initiativeAgreement' },
      isLoading: false,
      isError: false,
    });

    renderComponent('/org-initiative-agreement/1');

    expect(screen.getByText('OrgTransactionDetails Component')).toBeInTheDocument();
  });
});
