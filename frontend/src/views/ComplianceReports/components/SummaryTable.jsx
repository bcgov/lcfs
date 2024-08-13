import { numberFormatter } from '@/utils/formatters'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material'

const SummaryTable = ({ title, columns, data }) => {
  const value = (cellValue) => {
    if (typeof cellValue === 'string') {
      return cellValue
    } else if (cellValue < 0) {
      return `(${Math.abs(cellValue)})`
    } else {
      return numberFormatter(cellValue)
    }
  }

  return (
    <TableContainer
      component={Paper}
      sx={{ margin: '20px 0', border: '1px solid #e0e0e0' }}
    >
      <Table
        sx={{ minWidth: 650, borderCollapse: 'separate', borderSpacing: 0 }}
        aria-label={`${title} table`}
      >
        <TableHead>
          <TableRow>
            {columns.map((column, index) => (
              <TableCell
                key={column.id}
                align={column.align || 'center'}
                sx={{
                  fontWeight: 'bold',
                  backgroundColor: '#f5f5f5',
                  borderBottom: '2px solid #e0e0e0',
                  borderRight:
                    index < columns.length - 1 ? '1px solid #e0e0e0' : 'none',
                  maxWidth: column.maxWidth || 'none',
                  width: column.width || 'auto',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {column.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data?.map((row, rowIndex) => (
            <TableRow
              key={row.line}
              sx={{ '&:last-child td, &:last-child th': { borderBottom: 0 } }}
            >
              {columns.map((column, colIndex) => (
                <TableCell
                  key={column.id}
                  align={column.align || 'left'}
                  sx={{
                    borderBottom:
                      rowIndex === data.length - 1
                        ? 'none'
                        : '1px solid #e0e0e0',
                    borderRight:
                      colIndex < columns.length - 1
                        ? '1px solid #e0e0e0'
                        : 'none',
                    maxWidth: column.maxWidth || 'none',
                    width: column.width || 'auto',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight:
                      column.bold || (column.id === 'description' && !row.line)
                        ? 'bold'
                        : 'normal'
                  }}
                >
                  {value(row[column.id])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default SummaryTable
