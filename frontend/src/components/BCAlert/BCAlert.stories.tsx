import type { Meta, StoryObj } from '@storybook/react'
import BCAlert from '@/components/BCAlert'

const meta: Meta<typeof BCAlert> = {
  title: 'BCGov/BCAlert',
  component: BCAlert
}

export default meta

type Story = StoryObj<typeof BCAlert>

export const Default: Story = {
  args: {
    severity: 'info',
    children: 'This is an Alert message.',
    dismissible: false
  }
}

export const SuccessAlert: Story = {
  args: {
    ...Default.args,
    children: 'Your application has been successfully submitted.',
    severity: 'success'
  }
}

export const ErrorAlert: Story = {
  args: {
    ...Default.args,
    severity: 'error',
    children: 'The email address cannot be empty.'
  }
}

export const WarningAlert: Story = {
  args: {
    ...Default.args,
    severity: 'warning',
    children: (
      <p>
        The <a>eligibility requirements</a> for this service have changed.
        Review the changes before continuing.
      </p>
    )
  }
}

export const DismissableInfo: Story = {
  args: {
    ...Default.args,
    dismissible: true,
    children:
      'The deadline for submission has been extended to March 1, 2020.'
  }
}
