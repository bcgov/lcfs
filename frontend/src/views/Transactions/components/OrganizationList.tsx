import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { useOrganizationNames } from '@/hooks/useOrganizations'
import { numberFormatter } from '@/utils/formatters'
import type { SyntheticEvent } from 'react'

interface OrganizationOption {
  organizationId: number | string | null
  name: string
  totalBalance: number
  reservedBalance: number
  label: string
}

interface OrganizationSummary extends Omit<OrganizationOption, 'label'> {}

interface OrganizationSelection {
  id: number | string | null
  label: string | null
  name: string | null
}

interface OrganizationListProps {
  selectedOrg?: OrganizationSelection | null
  onOrgChange: (selection: OrganizationSelection) => void
  onlyRegistered?: boolean
  orgFilter?: string
  includeAllOption?: boolean
  label?: string
  placeholder?: string
  showSelectedLabel?: boolean
}

const OrganizationList = ({
  selectedOrg,
  onOrgChange,
  onlyRegistered = true,
  orgFilter,
  includeAllOption = true,
  label,
  placeholder,
  showSelectedLabel = true
}: OrganizationListProps) => {
  const { t } = useTranslation(['transaction'])
  const statuses = onlyRegistered ? ['Registered'] : null
  const { data, isLoading } = useOrganizationNames<OrganizationSummary>(
    statuses,
    orgFilter ? { orgFilter } : {}
  )
  const [optionsList, setOptionsList] = useState<OrganizationOption[]>([])

  useEffect(() => {
    if (!isLoading && data) {
      const formattedData = data.map((org) => ({
        ...org,
        label: `${org.name} ${t(
          'txn:complianceUnitsBalance'
        )}: ${numberFormatter({ value: org.totalBalance })} (${numberFormatter({
          value: Math.abs(org.reservedBalance)
        })} ${t('txn:inReserve')})`
      }))

      const allOrganizationsOption = {
        organizationId: null,
        name: t('txn:allOrganizations'),
        totalBalance: 0,
        reservedBalance: 0,
        label: t('txn:allOrganizations')
      }

      setOptionsList(
        includeAllOption
          ? [allOrganizationsOption, ...formattedData]
          : formattedData
      )
    }
  }, [data, includeAllOption, isLoading, t])

  const onInputBoxChanged = (
    _event: SyntheticEvent,
    input: OrganizationOption | null
  ) => {
    if (!input || input.name === t('txn:allOrganizations')) {
      onOrgChange({ id: null, label: null, name: null })
    } else {
      onOrgChange({
        id: input.organizationId,
        label: input.label,
        name: input.name
      })
    }
  }

  return (
    <Box component="div" mb={2}>
      {showSelectedLabel && (
        <BCTypography variant="body2" color="primary">
          {selectedOrg?.label}
        </BCTypography>
      )}
      <Stack
        component="div"
        direction={{ md: 'column', lg: 'row' }}
        spacing={1}
        mt={1}
        useFlexGap
        flexWrap="wrap"
      >
        <BCTypography variant="body2" color="primary" mt={1}>
          {label ?? `${t('txn:showTransactionsInvolve')}:`}&nbsp;
        </BCTypography>
        <Autocomplete
          disablePortal
          id="organizations"
          loading={isLoading}
          options={optionsList}
          getOptionLabel={(option) => option.name}
          getOptionKey={(option) => option.organizationId ?? 'all'}
          onChange={onInputBoxChanged}
          value={
            optionsList.find(
              (option) =>
                String(option.organizationId) === String(selectedOrg?.id)
            ) || null
          }
          sx={({ functions: { pxToRem } }) => ({
            width: 300,
            '& .MuiOutlinedInput-root': { padding: pxToRem(0) }
          })}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder={placeholder ?? t('txn:selectOrganizationName')}
              aria-label={placeholder ?? t('txn:selectOrganizationName')}
              slotProps={{
                htmlInput: {
                  ...params.inputProps,
                  style: { fontSize: 16, padding: '8px' }
                }
              }}
            />
          )}
        />
      </Stack>
    </Box>
  )
}

export default OrganizationList
