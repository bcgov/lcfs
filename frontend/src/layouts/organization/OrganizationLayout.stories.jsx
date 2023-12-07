// OrganizationLayout.stories.js
import OrganizationLayout from './OrganizationLayout'

export default {
  title: '@/layouts/OrganizationLayout',
  component: OrganizationLayout
}

const Template = (args) => <OrganizationLayout {...args} />

export const Default = Template.bind({})
Default.args = {}
