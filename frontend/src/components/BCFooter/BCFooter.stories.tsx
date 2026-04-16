import type { Meta, StoryObj } from '@storybook/react'
import BCFooter from '@/components/BCFooter/index'

const meta: Meta<typeof BCFooter> = {
  title: 'BCGov/BCFooter',
  component: BCFooter
}

export default meta

type Story = StoryObj<typeof BCFooter>

export const Default: Story = {
  args: {
    links: [
      {
        href: '/',
        name: 'Home',
        id: 'footer-home',
        label: 'Home page of LCFS'
      },
      {
        href: 'https://www2.gov.bc.ca/gov/content/industry/electricity-alternative-energy/transportation-energies/renewable-low-carbon-fuels/transportation-fuels-reporting-system',
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
      }
    ],
    repoDetails: {
      href: 'https://github.com/bcgov/lcfs/releases/tag/v0.2.0',
      name: 'v0.2.0',
      id: 'footer-about-version',
      label: 'LCFS repository changelog'
    }
  }
}
