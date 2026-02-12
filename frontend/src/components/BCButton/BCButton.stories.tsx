import type { Meta, StoryObj } from '@storybook/react'
import BCButton from './index'

const meta: Meta<typeof BCButton> = {
  title: 'BCGov/BCButton',
  component: BCButton,
  parameters: {
    docs: {
      description: {
        component: 'Buttons for actions in apps and websites.'
      }
    }
  }
}

export default meta

type Story = StoryObj<typeof BCButton>

const baseArgs = {
  color: 'primary',
  variant: 'contained',
  size: 'medium',
  circular: false,
  iconOnly: false,
  children: 'Click Me',
  disabled: false
}

export const Default: Story = {
  args: baseArgs
}

export const ContainedVariant: Story = {
  args: {
    ...baseArgs,
    variant: 'contained'
  }
}

export const ContainedDisabledVariant: Story = {
  args: {
    ...baseArgs,
    variant: 'contained',
    disabled: true
  }
}

export const OutlinedVariant: Story = {
  args: {
    ...baseArgs,
    variant: 'outlined'
  }
}

export const OutlinedDisabledVariant: Story = {
  args: {
    ...baseArgs,
    variant: 'outlined',
    disabled: true
  }
}

export const GradientVariant: Story = {
  args: {
    ...baseArgs,
    variant: 'gradient'
  }
}

export const TextVariant: Story = {
  args: {
    ...baseArgs,
    variant: 'text'
  }
}

export const SmallSize: Story = {
  args: {
    ...baseArgs,
    size: 'small'
  }
}

export const LargeSize: Story = {
  args: {
    ...baseArgs,
    size: 'large'
  }
}
