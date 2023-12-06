import BCAlert from 'components/BCAlert';

export default {
  title: 'BCGov/BCAlert',
  component: BCAlert,
};

const Template = (args) => <BCAlert {...args}/>;

export const Default = Template.bind({});
Default.args = {
  severity: 'info',
  children: "This is an Alert message.",
  dismissible: false,
};

export const SuccessAlert = Template.bind({});
SuccessAlert.args = {
  ...Default.args,
  children: "Your application has been successfully submitted.",
  severity: 'success',
};

export const ErrorAlert = Template.bind({});
ErrorAlert.args = {
  ...Default.args,
  severity: 'error',
  children: "The email address cannot be empty."
};

export const WarningAlert = Template.bind({});
WarningAlert.args = {
  ...Default.args,
  severity: 'warning',
  children: <p>The <a>eligibility requirements</a> for this service have changed. Review the changes before continuing.</p>
};

export const DismissableInfo = Template.bind({});
DismissableInfo.args = {
  ...Default.args,
  dismissible: true,
  children: "The deadline for submission has been extended to March 1, 2020.",
};
