import React from 'react';
import BCBox from 'components/BCBox';

export default {
  title: 'BCGov/BCBox',
  component: BCBox,
};

const Template = (args) => <BCBox {...args}>Box Content</BCBox>;

export const Default = Template.bind({});
Default.args = {
  variant: 'contained',
  bgColor: 'transparent',
  color: 'dark',
  opacity: 1,
  borderRadius: 'none',
  shadow: 'none',
  coloredShadow: 'none',
};

export const GradientVariant = Template.bind({});
GradientVariant.args = {
  ...Default.args,
  variant: 'gradient',
};

export const SuccessVariant = Template.bind({});
SuccessVariant.args = {
  ...Default.args,
  variant: 'success',
};

export const InfoVariant = Template.bind({});
InfoVariant.args = {
  ...Default.args,
  variant: 'info',
};

export const WarningVariant = Template.bind({});
WarningVariant.args = {
  ...Default.args,
  variant: 'warning',
};

export const ErrorVariant = Template.bind({});
ErrorVariant.args = {
  ...Default.args,
  variant: 'error',
};

export const ColoredShadow = Template.bind({});
ColoredShadow.args = {
  ...Default.args,
  coloredShadow: 'primary',
};

export const CustomStyles = Template.bind({});
CustomStyles.args = {
  ...Default.args,
  bgColor: '#000',
  color: 'light',
  opacity: 0.8,
  borderRadius: '4px',
  shadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
};
