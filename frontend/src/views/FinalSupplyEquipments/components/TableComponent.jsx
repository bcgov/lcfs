import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material'

export const ExcelStyledTable = ({ uniqueSupplyUnits, overlapMap }) => {
  return (
    <TableContainer component={Paper} sx={{ maxHeight: 200, borderRadius: 0 }}>
      <Table
        size="small"
        stickyHeader
        sx={{
          '& .MuiTableCell-root': {
            fontSize: '0.71rem',
            p: 0,
            pl: 0.2,
            pr: 0.2
          }
        }}
      >
        <TableHead>
          <TableRow sx={{ backgroundColor: '#f4f4f4' }}>
            <TableCell
              sx={{
                border: '1px solid #d0d0d0',
                fontWeight: 'bold',
                backgroundColor: '#dfe6e9'
              }}
            >
              Reg #
            </TableCell>
            <TableCell
              sx={{
                border: '1px solid #d0d0d0',
                fontWeight: 'bold',
                backgroundColor: '#dfe6e9'
              }}
            >
              Serial #
            </TableCell>
            <TableCell
              sx={{
                border: '1px solid #d0d0d0',
                fontWeight: 'bold',
                backgroundColor: '#dfe6e9'
              }}
            >
              Periods
            </TableCell>
            <TableCell
              sx={{
                border: '1px solid #d0d0d0',
                fontWeight: 'bold',
                backgroundColor: '#dfe6e9'
              }}
            >
              Status
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.values(uniqueSupplyUnits).map((unit, index) => {
            const sortedRecords = [...unit.records].sort(
              (a, b) => new Date(a.supplyFromDate) - new Date(b.supplyFromDate)
            )

            return (
              <React.Fragment key={index}>
                <TableRow
                  sx={{
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9f9f9',
                    '&:hover': { backgroundColor: '#e3f2fd' }
                  }}
                >
                  <TableCell
                    sx={{ border: '1px solid #d0d0d0', fontSize: '14px' }}
                  >
                    {unit.regNum}
                  </TableCell>
                  <TableCell
                    sx={{ border: '1px solid #d0d0d0', fontSize: '14px' }}
                  >
                    {unit.serialNum}
                  </TableCell>
                  <TableCell
                    sx={{ border: '1px solid #d0d0d0', fontSize: '14px' }}
                  >
                    {sortedRecords.map((record, idx) => (
                      <div
                        key={idx}
                        style={{
                          color: record.hasOverlap ? 'orange' : 'inherit',
                          fontWeight: record.hasOverlap ? 'bold' : 'normal'
                        }}
                      >
                        {record.supplyFromDate} → {record.supplyToDate}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell
                    sx={{
                      border: '1px solid #d0d0d0',
                      fontSize: '14px',
                      color: unit.hasOverlap ? 'orange' : 'green'
                    }}
                  >
                    {unit.hasOverlap ? '⚠️ Period overlap' : '✓ No overlap'}
                  </TableCell>
                </TableRow>

                {/* Overlapping Period Details */}
                {unit.hasOverlap &&
                  sortedRecords
                    .filter((record) => record.hasOverlap)
                    .map((record, idx) => (
                      <TableRow
                        key={`detail-${idx}`}
                        sx={{
                          backgroundColor: '#fff3e0', // Light orange for warnings
                          '&:hover': { backgroundColor: '#ffe0b2' } // Darker on hover
                        }}
                      >
                        <TableCell
                          colSpan={4}
                          sx={{ border: '1px solid #d0d0d0', pl: 3 }}
                        >
                          <strong>Details for period:</strong>{' '}
                          {record.supplyFromDate} → {record.supplyToDate}
                          <br />
                          <strong style={{ color: 'orange' }}>
                            ⚠️ Overlaps with:
                          </strong>
                          <ul style={{ paddingLeft: 20, margin: '5px 0' }}>
                            {overlapMap[record.uniqueId].map((overlap, i) => (
                              <li key={i}>
                                Period: {overlap.supplyFromDate} →{' '}
                                {overlap.supplyToDate}
                              </li>
                            ))}
                          </ul>
                        </TableCell>
                      </TableRow>
                    ))}
              </React.Fragment>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
