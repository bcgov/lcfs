import React, { useState } from 'react'
import {
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material'
import 'styles/Organization.css'

const CustomTable = ({ data }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const filteredData = data ? data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) : [];
  const totalPages = data ? Math.ceil(data.length / rowsPerPage) : 0;


  return (
    <TableContainer component={Paper} className='table-container'>
      <Table className='table-border'>
        <TableHead>
          <TableRow>
            <TableCell className='table-cell'>
              <TextField label="Username" variant="outlined" style={{ width: '100%', border: '1px solid #000' }} />
            </TableCell>
            <TableCell className='table-cell'>
              <TextField label="Role(s)" variant="outlined" style={{ width: '100%', border: '1px solid #000' }} />
            </TableCell>
            <TableCell className='table-cell'>
              <TextField label="Email" variant="outlined" style={{ width: '100%', border: '1px solid #000' }} />
            </TableCell>
            <TableCell className='table-cell'>
              <TextField label="Phone" variant="outlined" style={{ width: '100%', border: '1px solid #000' }} />
            </TableCell>
            <TableCell className='table-cell'>
              <TextField label="Status" variant="outlined" style={{ width: '100%', border: '1px solid #000' }} />
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredData.map((row, index) => (
            <TableRow key={index} className='table-row'>
              <TableCell className='table-cell'>{row.name}</TableCell>
              <TableCell className='table-cell'>{row.roles}</TableCell>
              <TableCell className='table-cell'>{row.email}</TableCell>
              <TableCell className='table-cell'>{row.phone}</TableCell>
              <TableCell className='table-cell'>{row.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
        <div style={{ flex: 1 }}>
          <Button variant="outlined" disabled={page === 0} onClick={(event) => handleChangePage(event, page - 1)} style={{ width: '100%' }}>Previous</Button>
        </div>
        <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '200px' }}>
          Page 
          <span style={{ border: '1px solid #000', padding: '5px', marginLeft: '5px', borderRadius: '5px' }}>{totalPages === 0 ? 0 : page + 1}</span> 
          of {totalPages}
        </div>
        <div>
          <FormControl variant="outlined" style={{ marginLeft: '5px' }}>
            <Select
              labelId="rowsPerPage"
              value={rowsPerPage}
              onChange={handleChangeRowsPerPage}
              label="Rows per page"
              style={{ border: '1px solid #000', marginRight: '300px' }}
            >
              <MenuItem value={5}>5 rows</MenuItem>
              <MenuItem value={10}>10 rows</MenuItem>
              <MenuItem value={20}>20 rows</MenuItem>
            </Select>
          </FormControl>
        </div>
        <div style={{ flex: 1 }}>
        <Button
        variant="outlined"
        disabled={data ? rowsPerPage * (page + 1) >= data.length : true}
        onClick={(event) => handleChangePage(event, page + 1)}
        style={{ width: '100%' }}
      >
        Next
      </Button>

        </div>
      </div>

    </TableContainer>
  );
};

export default CustomTable;
