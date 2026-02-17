import type { Meta, StoryObj } from '@storybook/react'
import BCNavbar from '@/components/BCNavbar'

const meta: Meta<typeof BCNavbar> = {
  title: 'BCGov/BCNavbar',
  component: BCNavbar
}

export default meta

type Story = StoryObj<typeof BCNavbar>

export const Default: Story = {
  args: {
    routes: [
      { icon: 'home', name: 'Dashboard', route: '/' },
      { name: 'Document', route: '/document' },
      { name: 'Transactions', route: '/transactions' },
      { name: 'Compliance Report', route: '/compliance-report' },
      { name: 'Organization', route: '/organization' },
      { name: 'Administration', route: '/administration' },
      { name: 'Log out', route: '/logout' }
    ]
  }
}
