// Organizations.stories.js
import Organizations from './Organizations'

export default {
  title: '@/views/Organizations',
  component: Organizations
}

const Template = (args) => <Organizations {...args} />

export const Default = Template.bind({})
Default.args = {}
