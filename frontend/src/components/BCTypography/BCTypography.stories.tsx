import type { Meta, StoryObj } from '@storybook/react'
import BCTypography from '@/components/BCTypography'

const meta: Meta<typeof BCTypography> = {
  title: 'BCGov/BCTypography',
  component: BCTypography
}

export default meta

type Story = StoryObj<typeof BCTypography>

const baseArgs = {
  children: 'Default Text',
  color: 'primary'
}

export const Default: Story = {
  args: baseArgs
}

export const Bold: Story = {
  args: {
    ...baseArgs,
    fontWeight: 'bold',
    children: 'Bold Text'
  }
}

export const Uppercase: Story = {
  args: {
    ...baseArgs,
    textTransform: 'uppercase',
    children: 'Uppercase Text'
  }
}

export const SecondaryColor: Story = {
  args: {
    ...baseArgs,
    color: 'secondary',
    backgroundColor: 'primary',
    children: 'Secondary Color Text'
  }
}
