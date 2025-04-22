import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import BCFooter from '../BCFooter'

vi.mock('../BCBox', () => ({
  __esModule: true,
  default: ({ children, ...props }) => <div {...props}>{children}</div>
}))

describe('BCFooter', () => {
  const links = [
    {
      id: 'footer-home',
      href: 'https://gov.bc.ca/',
      name: 'Home',
      label: 'Home page of LCFS'
    },
    {
      id: 'footer-about-this-site',
      href: 'https://www.gov.bc.ca/aboutgov',
      name: 'About this site',
      label: 'About this site'
    }
  ]
  const repoDetails = {
    id: 'footer-about-version',
    href: 'https://github.com/bcgov/lcfs/releases/tag/v1.0.3',
    name: 'v1.0.3',
    label: 'LCFS repository changelog'
  }

  it('renders all provided links with correct attributes', () => {
    render(<BCFooter links={links} repoDetails={repoDetails} />)
    links.forEach((link) => {
      const el = screen.getByTestId(link.id)
      expect(el).toBeInTheDocument()
      expect(el).toHaveAttribute('href', link.href)
      expect(el).toHaveTextContent(link.name)
      expect(el).toHaveAttribute('aria-label', link.label)
    })
  })

  it('renders repoDetails with correct attributes', () => {
    render(<BCFooter links={links} repoDetails={repoDetails} />)
    const repoLink = screen.getByTestId(repoDetails.id)
    expect(repoLink).toBeInTheDocument()
    expect(repoLink).toHaveAttribute('href', repoDetails.href)
    expect(repoLink).toHaveTextContent(repoDetails.name)
    expect(repoLink).toHaveAttribute('aria-label', repoDetails.label)
  })

  it('renders nothing if no links or repoDetails are provided', () => {
    const { container } = render(<BCFooter links={[]} repoDetails={{}} />)
    const footerLinks = container.querySelectorAll('a[data-test]')
    expect(footerLinks.length).toBe(0)
    expect(container.querySelector('.MuiTypography-button').textContent).toBe(
      ''
    )
  })

  it('renders only repoDetails if links is empty', () => {
    render(<BCFooter links={[]} repoDetails={repoDetails} />)
    const repoLink = screen.getByTestId(repoDetails.id)
    expect(repoLink).toBeInTheDocument()
    expect(screen.queryByTestId(links[0]?.id)).not.toBeInTheDocument()
  })

  it('renders only links if repoDetails is missing', () => {
    render(<BCFooter links={links} repoDetails={{}} />)

    links.forEach((link) => {
      expect(screen.getByTestId(link.id)).toBeInTheDocument()
    })

    expect(screen.queryByTestId('footer-about-version')).not.toBeInTheDocument()
  })
})
