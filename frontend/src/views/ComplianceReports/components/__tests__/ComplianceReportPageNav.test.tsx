import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ComplianceReportPageNav } from '../ComplianceReportPageNav'

vi.mock('@mui/icons-material', () => ({
  AutoAwesome: () => <span data-test="auto-awesome-icon" />,
  Description: () => <span data-test="description-icon" />,
  ElectricBolt: () => <span data-test="electric-bolt-icon" />,
  FactCheck: () => <span data-test="fact-check-icon" />,
  Gavel: () => <span data-test="gavel-icon" />,
  Handshake: () => <span data-test="handshake-icon" />,
  LocalGasStation: () => <span data-test="local-gas-station-icon" />,
  Recycling: () => <span data-test="recycling-icon" />,
  Summarize: () => <span data-test="summarize-icon" />,
  SwapHoriz: () => <span data-test="swap-horiz-icon" />,
  UploadFile: () => <span data-test="upload-file-icon" />
}))

const intersectionObservers: MockIntersectionObserver[] = []

class MockIntersectionObserver {
  callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    intersectionObservers.push(this)
  }

  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
  takeRecords = vi.fn(() => [])
}

class MockMutationObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])
}

const items = [
  { id: 'report-section-analyst-review', label: 'Analyst review' },
  { id: 'report-section-summary', label: 'Summary' }
]

describe('ComplianceReportPageNav', () => {
  beforeEach(() => {
    intersectionObservers.length = 0
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    vi.stubGlobal('MutationObserver', MockMutationObserver)
    vi.stubGlobal('scrollTo', vi.fn())

    items.forEach((item) => {
      const section = document.createElement('section')
      section.id = item.id
      section.getBoundingClientRect = vi.fn(
        () =>
          ({
            top: 500,
            left: 0,
            bottom: 700,
            right: 100,
            width: 100,
            height: 200,
            x: 0,
            y: 500,
            toJSON: () => ({})
          }) as DOMRect
      )
      document.body.appendChild(section)
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('renders available report sections and scrolls to a selected section', async () => {
    const user = userEvent.setup()

    render(<ComplianceReportPageNav items={items} />)

    expect(
      await screen.findAllByRole('button', { name: 'Go to Analyst review' })
    ).toHaveLength(2)
    expect(
      screen.getAllByRole('button', { name: 'Go to Summary' })
    ).toHaveLength(2)

    await user.click(
      screen.getAllByRole('button', { name: 'Go to Summary' })[0]
    )

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 404,
      behavior: 'smooth'
    })
  })

  it('marks the intersecting section as current', async () => {
    render(<ComplianceReportPageNav items={items} />)

    await screen.findAllByRole('button', { name: 'Go to Analyst review' })

    act(() => {
      intersectionObservers[0].callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 0.5,
            target: document.getElementById('report-section-summary')!
          } as IntersectionObserverEntry
        ],
        intersectionObservers[0] as unknown as IntersectionObserver
      )
    })

    expect(
      screen.getAllByRole('button', { name: 'Go to Summary' })[0]
    ).toHaveAttribute('aria-current', 'location')
  })

  it('does not render when fewer than two target sections are present', () => {
    document.getElementById('report-section-summary')?.remove()

    const { container } = render(<ComplianceReportPageNav items={items} />)

    expect(container).toBeEmptyDOMElement()
  })
})
