import React from 'react'
import { currencyFormatter, numberFormatter } from '@/utils/formatters'
import {
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material'
import BCTypography from '@/components/BCTypography'
import Box from '@mui/material/Box'
import { useTranslation } from 'react-i18next'

const CompareTable = ({
  title,
  columns,
  data,
  useParenthesis = false,
  enableFuelControls = false,
  setFuelType,
  fuelType
}) => {
  const { t } = useTranslation(['common', 'report'])
  const rowFormatters = {
    number: numberFormatter,
    currency: currencyFormatter
  }

  const tableStyles = {
    container: { margin: '20px 0', border: '1px solid #495057' },
    table: { minWidth: 650, borderCollapse: 'separate', borderSpacing: 0 },
    headerCell: {
      fontWeight: 'bold',
      backgroundColor: '#f0f0f0',
      borderBottom: '2px solid #495057'
    },
    bodyCell: {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      display: 'block'
    }
  }

  return (
    <TableContainer component={Paper} sx={tableStyles.container}>
      <Table sx={tableStyles.table} aria-label={`${title} table`}>
        {enableFuelControls && (
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  ...tableStyles.headerCell,
                  borderRight: '1px solid #495057',
                  maxWidth: columns[1].maxWidth || 'none',
                  width: columns[1].width || 'auto'
                }}
              ></TableCell>
              <TableCell
                align="center"
                sx={{
                  ...tableStyles.headerCell,
                  borderRight: '1px solid #495057',
                  maxWidth: columns[1].maxWidth || 'none',
                  width: columns[1].width || 'auto'
                }}
              >
                {columns[1].label}
              </TableCell>
              <TableCell
                colSpan={3}
                sx={{
                  ...tableStyles.headerCell,
                  maxWidth: columns[1].maxWidth || 'none',
                  width: columns[1].width || 'auto'
                }}
              >
                <Box>
                  <RadioGroup
                    row
                    value={fuelType}
                    onChange={(event) => {
                      setFuelType(event.target.value)
                    }}
                    sx={{ justifyContent: 'space-evenly' }}
                    id="fuelType"
                  >
                    <FormControlLabel
                      value="gasoline"
                      control={<Radio />}
                      label={
                        <BCTypography variant="label">
                          {t('report:fuelLabels.gasoline')}
                        </BCTypography>
                      }
                      sx={{ alignItems: 'center', marginRight: '8px' }}
                    />
                    <FormControlLabel
                      value="diesel"
                      control={<Radio />}
                      label={
                        <BCTypography variant="label">
                          {t('report:fuelLabels.diesel')}
                        </BCTypography>
                      }
                      sx={{ alignItems: 'center', marginRight: '8px' }}
                    />
                    <FormControlLabel
                      value="jetFuel"
                      control={<Radio />}
                      label={
                        <BCTypography variant="label">
                          {t('report:fuelLabels.jetFuel')}
                        </BCTypography>
                      }
                      sx={{ alignItems: 'center', marginRight: '8px' }}
                    />
                  </RadioGroup>
                </Box>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell
                align="center"
                sx={{
                  ...tableStyles.headerCell,
                  borderRight: '1px solid #495057',
                  maxWidth: columns[1].maxWidth || 'none',
                  width: columns[1].width || 'auto'
                }}
              >
                {columns[0].label}
              </TableCell>

              <TableCell
                align="center"
                sx={{
                  ...tableStyles.headerCell,
                  borderRight: '1px solid #495057',
                  maxWidth: columns[1].maxWidth || 'none',
                  width: columns[1].width || 'auto'
                }}
              ></TableCell>
              <TableCell
                align="center"
                sx={{
                  ...tableStyles.headerCell,
                  borderRight: '1px solid #495057',
                  maxWidth: columns[2].maxWidth || 'none',
                  width: columns[2].width || 'auto'
                }}
              >
                {columns[2].label}
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  ...tableStyles.headerCell,
                  maxWidth: columns[3].maxWidth || 'none',
                  width: columns[3].width || 'auto',
                  borderRight: '1px solid #495057'
                }}
              >
                {columns[3].label}
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  ...tableStyles.headerCell,
                  maxWidth: columns[4].maxWidth || 'none',
                  width: columns[4].width || 'auto'
                }}
              >
                {columns[4].label}
              </TableCell>
            </TableRow>
          </TableHead>
        )}
        {!enableFuelControls && (
          <TableHead>
            <TableRow>
              {columns.map((column, index) => (
                <TableCell
                  key={column.id}
                  align="center"
                  sx={{
                    ...tableStyles.headerCell,
                    borderRight:
                      index < columns.length - 1 ? '1px solid #495057' : 'none',
                    maxWidth: column.maxWidth || 'none',
                    width: column.width || 'auto'
                  }}
                >
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
        )}
        <TableBody>
          {data?.map((row, rowIndex) => (
            <TableRow
              key={row.line}
              sx={{
                '&:last-child td, &:last-child th': { borderBottom: 0 },
                backgroundColor: '#fcfcfc'
              }}
            >
              {columns.map((column, colIndex) => (
                <TableCell
                  key={column.id}
                  align={column.align || 'left'}
                  sx={{
                    borderBottom:
                      rowIndex === data.length - 1
                        ? 'none'
                        : '1px solid #495057',
                    borderRight:
                      colIndex < columns.length - 1
                        ? '1px solid #495057'
                        : 'none',
                    maxWidth: column.maxWidth || 'none',
                    width: column.width || 'auto'
                  }}
                >
                  <span
                    style={{
                      ...tableStyles.bodyCell,
                      fontWeight:
                        column.bold ||
                        (column.id === 'description' && !row.line)
                          ? 'bold'
                          : 'normal'
                    }}
                  >
                    {row.format &&
                    colIndex !== 0 &&
                    row[column.id] !== undefined &&
                    row[column.id] !== null
                      ? rowFormatters[row.format](
                          row[column.id],
                          useParenthesis
                        )
                      : row[column.id] === undefined || row[column.id] === null
                        ? column.id !== 'description'
                          ? '0'
                          : ''
                        : row[column.id]}
                  </span>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default CompareTable
