// Import necessary libraries and components
import React from 'react';
import BCTypography from 'components/BCTypography';

// Define a template for the stories
const Template = (args) => <BCTypography {...args} />;

export default {
  title: 'BCGov/BCTypography',
  component: BCTypography,
};

// Define the stories
export const Default = Template.bind({});
Default.args = {
  children: 'Default Text',
  color: "primary",
};

export const Bold = Template.bind({});
Bold.args = {
  ...Default.args,
  fontWeight: 'bold',
  children: 'Bold Text',
};

export const Uppercase = Template.bind({});
Uppercase.args = {
  ...Default.args,
  textTransform: 'uppercase',
  children: 'Uppercase Text',
};

export const SecondaryColor = Template.bind({});
SecondaryColor.args = {
  ...Default.args,
  color: 'secondary',
  backgroundColor: 'primary',
  children: 'Secondary Color Text',
};
