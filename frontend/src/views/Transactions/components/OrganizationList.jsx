import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Box, Stack, Autocomplete, TextField } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { useOrganizationNames } from '@/hooks/useOrganizations'
import { numberFormatter } from '@/utils/formatters'

const OrganizationList = ({ onOrgChange, onlyRegistered = true }) => {
  const { t } = useTranslation(['transaction'])
  const { data, isLoading } = useOrganizationNames(onlyRegistered)
  const [optionsList, setOptionsList] = useState([])
  const [org, setOrg] = useState(null)

  useEffect(() => {
    if (!isLoading) {
      const formattedData = data.map((org) => ({
        ...org,
        label: `${org.name} ${t(
          'txn:complianceUnitsBalance'
        )}: ${numberFormatter({ value: org.totalBalance })} (${numberFormatter({
          value: Math.abs(org.reservedBalance)
        })} ${t('txn:inReserve')})`
      }))

      setOptionsList([
        {
          organizationId: null,
          name: t('txn:allOrganizations'),
          totalBalance: 0,
          reservedBalance: 0,
          label: t('txn:allOrganizations')
        },
        ...formattedData
      ])
    }
  }, [data, isLoading, t])

  const onInputBoxChanged = (event, input) => {
    if (!input || input.name === t('txn:allOrganizations')) {
      setOrg(null)
      onOrgChange(null)
    } else {
      setOrg(input.label)
      onOrgChange(input.organizationId)
    }
  }

  return (
    <Box component="div" mb={2}>
      <BCTypography variant="body2" color="primary">
        {org}
      </BCTypography>
      <Stack
        component="div"
        direction={{ md: 'coloumn', lg: 'row' }}
        spacing={1}
        mt={1}
        useFlexGap
        flexWrap="wrap"
      >
        <BCTypography variant="body2" color="primary" mt={1}>
          {t('txn:showTransactionsInvolve')}:&nbsp;
        </BCTypography>
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
              placeholder={t('txn:selectOrganizationName')}
              aria-label={t('txn:selectOrganizationName')}
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
  onOrgChange: PropTypes.func.isRequired
}

export default OrganizationList
