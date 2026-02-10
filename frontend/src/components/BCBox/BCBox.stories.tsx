import type { Meta, StoryObj } from '@storybook/react'
import type { ComponentProps } from 'react'
import BCBox from '@/components/BCBox'

const meta: Meta<typeof BCBox> = {
  title: 'BCGov/BCBox',
  component: BCBox
}

export default meta

type Story = StoryObj<typeof BCBox>

type BCBoxStoryProps = ComponentProps<typeof BCBox>

const baseArgs: BCBoxStoryProps = {
  variant: 'contained',
  bgColor: 'transparent',
  color: 'dark',
  opacity: 1,
  borderRadius: 'none',
  shadow: 'none',
  coloredShadow: 'none',
  children: 'Box Content'
}

export const Default: Story = {
  args: baseArgs
}

export const GradientVariant: Story = {
  args: {
    ...baseArgs,
    variant: 'gradient'
  }
}

export const SuccessVariant: Story = {
  args: {
    ...baseArgs,
    variant: 'success'
  }
}

export const InfoVariant: Story = {
  args: {
    ...baseArgs,
    variant: 'info'
  }
}

export const WarningVariant: Story = {
  args: {
    ...baseArgs,
    variant: 'warning'
  }
}

export const ErrorVariant: Story = {
  args: {
    ...baseArgs,
    variant: 'error'
  }
}

export const ColoredShadow: Story = {
  args: {
    ...baseArgs,
    coloredShadow: 'primary'
  }
}

export const CustomStyles: Story = {
  args: {
    ...baseArgs,
    bgColor: '#000',
    color: 'light',
    opacity: 0.8,
    borderRadius: '4px',
    shadow: '0 2px 5px rgba(0, 0, 0, 0.1)'
  }
}
