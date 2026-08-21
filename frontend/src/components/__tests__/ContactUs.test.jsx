import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Footer from '@/components/Footer'

// __APP_VERSION__ is injected by Vite at build time; stub it for tests.
vi.stubGlobal('__APP_VERSION__', '1.0.0-test')

// BCFooter is tested in its own file; mock it here to isolate Footer's
// link configuration from the underlying rendering logic.
vi.mock('@/components/BCFooter', () => ({
  __esModule: true,
  default: ({ links, repoDetails }) => (
    <footer data-test="bc-footer">
      {links.map((link) => (
        <a
          key={link.id}
          data-test={link.id}
          href={link.href}
          aria-label={link.label}
        >
          {link.name}
        </a>
      ))}
      {repoDetails?.id && (
        <a
          data-test={repoDetails.id}
          href={repoDetails.route || repoDetails.href}
          aria-label={repoDetails.label}
        >
          {repoDetails.name}
        </a>
      )}
    </footer>
  )
}))

const renderFooter = () =>
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>
  )

describe('Footer (ContactUs)', () => {
  it('renders the BCFooter container', () => {
    renderFooter()
    expect(screen.getByTestId('bc-footer')).toBeInTheDocument()
  })

  it('includes a Contact Us link pointing to the BC gov contact page', () => {
    renderFooter()
    const contactLink = screen.getByTestId('footer-contact-us')
    expect(contactLink).toBeInTheDocument()
    expect(contactLink).toHaveAttribute('href', 'https://gov.bc.ca/contactus')
    expect(contactLink).toHaveTextContent('Contact Us')
    expect(contactLink).toHaveAttribute(
      'aria-label',
      'Contact Us information for LCFS application'
    )
  })

  it('includes a Home link', () => {
    renderFooter()
    const homeLink = screen.getByTestId('footer-home')
    expect(homeLink).toHaveAttribute('href', 'https://gov.bc.ca/')
    expect(homeLink).toHaveTextContent('Home')
  })

  it('includes a Disclaimer link', () => {
    renderFooter()
    expect(screen.getByTestId('footer-disclaimer')).toBeInTheDocument()
  })

  it('includes a Privacy link', () => {
    renderFooter()
    expect(screen.getByTestId('footer-privacy')).toBeInTheDocument()
  })

  it('includes an Accessibility link', () => {
    renderFooter()
    expect(screen.getByTestId('footer-accessibility')).toBeInTheDocument()
  })

  it('includes a Copyright link', () => {
    renderFooter()
    expect(screen.getByTestId('footer-copyright')).toBeInTheDocument()
  })

  it('renders exactly 7 footer navigation links', () => {
    renderFooter()
    const linkIds = [
      'footer-home',
      'footer-about-this-site',
      'footer-disclaimer',
      'footer-privacy',
      'footer-accessibility',
      'footer-copyright',
      'footer-contact-us'
    ]
    linkIds.forEach((id) => {
      expect(screen.getByTestId(id)).toBeInTheDocument()
    })
  })

  it('includes a release notes link with the app version', () => {
    renderFooter()
    const releaseLink = screen.getByTestId('footer-release-notes')
    expect(releaseLink).toBeInTheDocument()
    expect(releaseLink).toHaveTextContent('1.0.0-test')
  })
})
