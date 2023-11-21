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
import PropTypes from 'prop-types'

const UserTable = ({ data }) => {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const handleChangePage = (event, newPage) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const filteredData = data ? data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) : []
  const totalPages = data ? Math.ceil(data.length / rowsPerPage) : 0
  const [inputPage, setInputPage] = useState(page + 1);


  return (
    <TableContainer component={Paper} className='table-container'>
      <Table className='table-border'>
        <TableHead>
          <TableRow>
            <TableCell className='table-cell'>
              <TextField label="Username" variant="outlined" className='table-text-field' />
            </TableCell>
            <TableCell className='table-cell'>
              <TextField label="Role(s)" variant="outlined" className='table-text-field' />
            </TableCell>
            <TableCell className='table-cell'>
              <TextField label="Email" variant="outlined" className='table-text-field' />
            </TableCell>
            <TableCell className='table-cell'>
              <TextField label="Phone" variant="outlined" className='table-text-field' />
            </TableCell>
            <TableCell className='table-cell'>
              <TextField label="Status" variant="outlined" className='table-text-field' />
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredData.map((row, index) => (
            <TableRow key={index} className='table-row'>
              <TableCell className='table-cell'>{row.username}</TableCell>
              <TableCell className='table-cell'>{row.roles}</TableCell>
              <TableCell className='table-cell'>{row.email}</TableCell>
              <TableCell className='table-cell'>{row.phone}</TableCell>
              <TableCell className='table-cell'>{row.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className='pagination-container'>
        <div className='pagination-btn'>
        <Button
          variant="outlined"
          disabled={page === 0} 
          onClick={(event) => {
            const newPage = page - 1;
            handleChangePage(event, newPage);
            setPage(newPage); 
          }}
          style={{ width: '100%' }}
        >
          Previous
        </Button>
        </div>
        <div className='pagination-info'>
          Page 
          <input
            type="number"
            value={totalPages === 0 ? 0 : page + 1} 
            min="1"
            max={totalPages}
            onChange={(e) => setInputPage(e.target.value)}
            className='pagination-page-input'
            onBlur={() => {
              const pageNumber = parseInt(inputPage, 10);
              if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages) {
                setPage(pageNumber - 1)
              } else {
                setInputPage(page + 1)
              }
            }}
          />
          &nbsp;of&nbsp; {totalPages}
          <FormControl variant="outlined" style={{ marginLeft: '5px' }}>
            <Select
              labelId="rowsPerPage"
              value={rowsPerPage}
              onChange={handleChangeRowsPerPage}
              label="Rows per page"
              className='pagination-select'
            >
              <MenuItem value={5}>5 rows</MenuItem>
              <MenuItem value={10}>10 rows</MenuItem>
              <MenuItem value={20}>20 rows</MenuItem>
            </Select>
          </FormControl>
        </div>
        <div className='pagination-btn'>
        <Button
          variant="outlined"
          disabled={data ? rowsPerPage * (page + 1) >= data.length : true}
          onClick={(event) => {
            const newPage = page + 1;
            handleChangePage(event, newPage);
            setPage(newPage)
          }}
          style={{ width: '100%' }}
        >
          Next
        </Button>
        </div>
      </div>

    </TableContainer>
  )
}

UserTable.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      username: PropTypes.string,
      roles: PropTypes.string,
      email: PropTypes.string,
      phone: PropTypes.string,
      status: PropTypes.string,
    })
  ),
}

export default UserTable
