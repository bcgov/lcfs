import BCNavbar from '@/components/BCNavbar'

export default {
  title: 'BCGov/BCNavbar',
  component: BCNavbar
}

const Template = (args) => <BCNavbar {...args} />

// Define the different stories
// Icons are optional
export const Default = Template.bind({})
Default.args = {
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
