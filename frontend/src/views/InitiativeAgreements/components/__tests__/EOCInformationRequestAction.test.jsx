import 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, vi } from 'vite-plus/test'
import { test } from '@/tests/utils/fixtures'
import { EOCInformationRequestAction } from '../EOCInformationRequestAction'

// The IDIR evidence card's per-EOC request (#5545).

const requestInformation = vi.fn()
vi.mock('@/hooks/useInitiativeAgreements', () => ({
  useRequestEocInformation: () => ({
    mutateAsync: requestInformation,
    isPending: false
  })
}))

const requirement = {
  evidenceRequirementId: 11,
  requirementNumber: 2,
  reviewOutcome: 'Information requested',
  missingInformation: '<p>Invoices</p>'
}

beforeEach(() => {
  vi.clearAllMocks()
  requestInformation.mockResolvedValue({})
})

test('requests this EOC only, after pending saves finish', async ({
  render,
  app
}) => {
  const order = []
  const beforeRequest = vi.fn(async () => order.push('saved'))
  requestInformation.mockImplementation(async (payload) => {
    order.push('requested')
    return payload
  })
  render(
    <EOCInformationRequestAction
      designatedActionId={3}
      requirement={requirement}
      eoc={{ informationRequestAvailable: true, informationRequests: [] }}
      canRequest
      beforeRequest={beforeRequest}
    />,
    app
  )
  const button = screen.getByRole('button', {
    name: 'Request additional information for EOC 2'
  })
  expect(button).toHaveTextContent('Request additional information')
  fireEvent.click(button)
  await waitFor(() =>
    expect(requestInformation).toHaveBeenCalledWith({
      evidenceRequirementId: 11
    })
  )
  expect(order).toEqual(['saved', 'requested'])
})

test('an empty Missing information is refused with an accessible error', async ({
  render,
  app
}) => {
  requestInformation.mockRejectedValue({
    response: {
      data: { detail: 'Enter the missing information before requesting it.' }
    }
  })
  render(
    <EOCInformationRequestAction
      designatedActionId={3}
      requirement={{ ...requirement, missingInformation: '' }}
      eoc={{ informationRequestAvailable: true, informationRequests: [] }}
      canRequest
    />,
    app
  )
  const button = screen.getByRole('button', {
    name: 'Request additional information for EOC 2'
  })
  fireEvent.click(button)
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(
    'Enter the missing information before requesting it.'
  )
  expect(button).toHaveAttribute('aria-describedby', alert.id)
})

test('an open request shows its state instead of the button', async ({
  render,
  app
}) => {
  render(
    <EOCInformationRequestAction
      designatedActionId={3}
      requirement={requirement}
      eoc={{
        informationRequestAvailable: true,
        informationRequests: [
          {
            id: 41,
            evidenceRequirementId: 11,
            status: 'Requested',
            requestedAt: '2026-11-20T18:00:00Z',
            requestedBy: 'Ana Lyst'
          }
        ]
      }}
      canRequest
    />,
    app
  )
  expect(screen.getByRole('status')).toHaveTextContent(
    /Additional information was requested .* by Ana Lyst\. Only this EOC is open/
  )
  expect(screen.queryByRole('button')).toBeNull()
})

test('nothing to offer when the submission is not open to requests', async ({
  render,
  app
}) => {
  const { container } = render(
    <EOCInformationRequestAction
      designatedActionId={3}
      requirement={requirement}
      eoc={{ informationRequestAvailable: false, informationRequests: [] }}
      canRequest
    />,
    app
  )
  expect(container).toBeEmptyDOMElement()
})

test('directors see no request button', async ({ render, app }) => {
  render(
    <EOCInformationRequestAction
      designatedActionId={3}
      requirement={requirement}
      eoc={{ informationRequestAvailable: true, informationRequests: [] }}
      canRequest={false}
    />,
    app
  )
  expect(screen.queryByRole('button')).toBeNull()
})
