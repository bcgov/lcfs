import React from 'react';
import UserTable from './UsersTable';

export default {
  title: 'Components/UserTable',
  component: UserTable,
  argTypes: {
    rowData: { control: null }, // Disable the rowData control in Storybook
  },
};

const generateDummyData = () => {
  const dummyData = [];
  for (let i = 1; i <= 30; i++) {
    dummyData.push({
      name: `User ${i}`,
      roles: `Role ${i}`,
      email: `user${i}@example.com`,
      phone: `123-456-${i}000`,
      status: i % 2 === 0 ? 'Active' : 'Inactive',
    });
  }
  return dummyData;
};

export const ThirtyRows = () => (
  <div style={{ width: '100%', height: '500px' }}> {/* Adjust height as needed */}
    <UserTable rowData={generateDummyData()} />
  </div>
);
