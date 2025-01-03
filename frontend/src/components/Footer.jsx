import { useMemo } from 'react'
import BCFooter from '@/components/BCFooter'

// /* global __VERSION__ */

const Footer = (props) => {
  const links = useMemo(
    () => [
      {
        href: 'https://gov.bc.ca/',
        name: 'Home',
        id: 'footer-home',
        label: 'Home page of LCFS'
      },
      {
        href: 'https://www.gov.bc.ca/aboutgov',
        name: 'About this site',
        id: 'footer-about-this-site',
        label: 'About this site'
      },
      {
        href: 'http://gov.bc.ca/disclaimer/',
        name: 'Disclaimer',
        id: 'footer-disclaimer',
        label: 'BC gov disclaimer information'
      },
      {
        href: 'http://gov.bc.ca/privacy/',
        name: 'Privacy',
        id: 'footer-privacy',
        label: 'BC gov privacy information'
      },
      {
        href: 'http://gov.bc.ca/webaccessibility/',
        name: 'Accessibility',
        id: 'footer-accessibility',
        label: 'BC gov accessibility information'
      },
      {
        href: 'http://gov.bc.ca/copyright',
        name: 'Copyright',
        id: 'footer-copyright',
        label: 'BC gov copyright information'
      },
      {
        href: 'https://gov.bc.ca/contactus',
        name: 'Contact Us',
        id: 'footer-contact-us',
        label: 'Contact Us information for LCFS application'
      }
    ],
    []
  )
  const repoDetails = useMemo(
    () => ({
      href: 'https://github.com/bcgov/lcfs/releases/tag/v0.2.0',
      name: 'v0.2.0',
      id: 'footer-about-version',
      label: 'LCFS repository changelog'
    }),
    []
  )
  return <BCFooter links={links} repoDetails={repoDetails} />
}

export default Footer
