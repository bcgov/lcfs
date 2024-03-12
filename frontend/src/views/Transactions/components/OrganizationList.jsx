import PropTypes from 'prop-types'
import { Box, Stack, Typography, Autocomplete, TextField } from '@mui/material'
import { useOrganizationNames } from '@/hooks/useOrganization'
import { useEffect, useState } from 'react'
import { AgGridReact } from '@ag-grid-community/react'
import { numberFormatter } from '@/utils/formatters'

const OrganizationList = ({ gridRef }) => {
  const { data, isLoading } = useOrganizationNames()
  const [optionsList, setOptionsList] = useState([])
  const [org, setOrg] = useState('All Organizations')
  const [balance, setBalance] = useState(0)

  const onInputBoxChanged = (event, input) => {
    const val = input ? input.name : ''
    if (val === '' || val === 'All Organizations') {
      // Remove the filter
      setOrg('All Organizations')
      setBalance(
        data.filter((item) => item.name === 'All Organizations').balance
      )
      gridRef?.current?.api.setFilterModel(null)
      return
    }

    setOrg(val)
    setBalance(input.balance)
    gridRef?.current?.api.setFilterModel({
      organizationId: {
        filterType: 'number',
        type: 'equals',
        filter: input.id
      }
    })
  }

  useEffect(() => {
    if (!isLoading) {
      setOptionsList(
        data.sort((a, b) =>
          ('' + a.name).localeCompare(b.name) > 0 ? 1 : -1
        )
      )
      setBalance(
        data.filter((item) => item.name === 'All Organizations').balance
      )
    }
  }, [data])

  return (
    <Box component="div" mb={2}>
      <Typography variant="body2" fontWeight="bold" color="primary">
        {org}&nbsp;compliance units:&nbsp;
        {numberFormatter({ value: balance || '100,000' })}
      </Typography>
      <Stack
        component="div"
        direction={{ md: 'coloumn', lg: 'row' }}
        spacing={1}
        mt={1}
        useFlexGap
        flexWrap="wrap"
      >
        <Typography variant="body2" color="primary" mt={1}>
          Show transactions involving:&nbsp;
        </Typography>
        <Autocomplete
          disablePortal
          id="organizations"
          loading={isLoading}
          options={optionsList}
          getOptionLabel={(option) => option.name}
          getOptionKey={(option) => option.organizationId}
          onChange={onInputBoxChanged}
          sx={({ functions: { pxToRem }, palette: { primary, light } }) => ({
            width: 300,
            '& .MuiOutlinedInput-root': { padding: pxToRem(0) }
          })}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Select organization name"
              aria-label="select organization name"
              value={org}
              inputProps={{
                ...params.inputProps,
                style: { fontSize: 16, padding: '8px' }
              }}
            />
          )}
        />
      </Stack>
    </Box>
  )
}

OrganizationList.propTypes = {
  gridRef: PropTypes.oneOfType([
    PropTypes.shape({ current: PropTypes.instanceOf(AgGridReact) }),
    PropTypes.func
  ]).isRequired
}

export default OrganizationList
