// UsersTable.stories.js

import React from 'react';
import UsersTable from './UsersTable'; // Import your UsersTable component

// Function to generate dummy data for the table (20 rows)
const generateDummyData = () => {
  const dummyData = [];
  for (let i = 1; i <= 20; i++) {
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

export default {
  title: 'Components/UsersTable',
  component: UsersTable,
};

export const TwentyRows = () => (
  <div style={{ maxWidth: '1000px' }}>
    <UsersTable data={generateDummyData()} />
  </div>
);
