import React from 'react';
import BCButton from './index';

export default {
  title: 'BCGov/BCButton',
  component: BCButton,
};

const Template = (args) => <BCButton {...args}>Click me</BCButton>;

export const Default = Template.bind({});
Default.args = {
  color: 'primary',
  variant: 'contained',
  size: 'medium',
  circular: false,
  iconOnly: false,
  darkMode: 'light',
  children: 'Click Me',
  disabled: false,
};

export const ContainedVariant = Template.bind({});
ContainedVariant.args = {
  ...Default.args,
  variant: 'contained',
};

export const ContainedDisabledVariant = Template.bind({});
ContainedDisabledVariant.args = {
  ...Default.args,
  variant: 'contained',
  disabled: true,
};

export const OutlinedVariant = Template.bind({});
OutlinedVariant.args = {
  ...Default.args,
  variant: 'outlined',
};

export const OutlinedDisabledVariant = Template.bind({});
OutlinedDisabledVariant.args = {
  ...Default.args,
  variant: 'outlined',
  disabled: true,
};
export const GradientVariant = Template.bind({});
GradientVariant.args = {
  ...Default.args,
  variant: 'gradient',
};

export const TextVariant = Template.bind({});
TextVariant.args = {
  ...Default.args,
  variant: 'text',
};

export const SmallSize = Template.bind({});
SmallSize.args = {
  ...Default.args,
  size: 'small',
};

export const LargeSize = Template.bind({});
LargeSize.args = {
  ...Default.args,
  size: 'large',
};