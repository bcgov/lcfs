import React, { useMemo, useEffect, useState } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
import '@ag-grid-community/styles/ag-grid.css';
import '@ag-grid-community/styles/ag-theme-alpine.css';
import { ModuleRegistry } from '@ag-grid-community/core';
import { coloumnDefinition, defaultColumnOptions } from './columnDef';

ModuleRegistry.registerModules([ClientSideRowModelModule]);

const OrganizationTable = (props) => {
  const columnDefs = useMemo(() => coloumnDefinition, []);
  const defaultColDef = useMemo(() => defaultColumnOptions, []);

  const [rowData, setRowData] = useState([]);

  useEffect(() => {
    // fetch('https://www.ag-grid.com/example-assets/olympic-winners.json')
    //   .then(resp => resp.json())
    //   .then(data => setRowData(data));
    setRowData([...props.rows])
  }, []);

  return (
    <div className="ag-theme-alpine" style={{ width: '100%', height: '100%' }}>
      <AgGridReact
        className="ag-theme-alpine"
        animateRows="true"
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowData={rowData}
        rowSelection="multiple"
        suppressRowClickSelection="true"
        pagination
        paginationPageSize={10}
        domLayout='autoHeight'
      />
    </div>
  );
};

export default OrganizationTable;
