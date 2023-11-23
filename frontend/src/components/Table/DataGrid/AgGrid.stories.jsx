import React from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import GridExample from './GridExample';

export default {
  title: 'Components/GridExample',
  component: AgGridReact,
};

const Template = () => {
  return (
    <div className="ag-theme-alpine" style={{ height: 400, width: '100%' }}>
      <GridExample />
    </div>
  );
};

export const Default = Template.bind({});
