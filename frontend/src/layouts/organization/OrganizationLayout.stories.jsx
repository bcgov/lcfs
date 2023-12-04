// OrganizationLayout.stories.js
import React from 'react';
import OrganizationLayout from './OrganizationLayout';

export default {
  title: 'Layouts/OrganizationLayout',
  component: OrganizationLayout,
};

const Template = (args) => <OrganizationLayout {...args} />;

export const Default = Template.bind({});
Default.args = {};
