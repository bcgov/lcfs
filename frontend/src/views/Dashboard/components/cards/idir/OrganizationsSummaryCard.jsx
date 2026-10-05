import React, { useEffect, useMemo, useState } from 'react'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import { useOrganizationNames } from '@/hooks/useOrganizations.js'
import { numberFormatter } from '@/utils/formatters'
import { useTranslation } from 'react-i18next'

const styles = {
  cardContent: {
    '& .MuiCardContent-root': {
      padding: '16px'
    }
  },
  select: {
    marginTop: 1,
    mx: 2,
    width: 'calc(100% - 32px)',
    bgcolor: 'background.paper',
    borderRadius: 1,
    height: '36px',
    '& .MuiSelect-select': {
      height: '36px !important',
      display: 'flex',
      alignItems: 'center',
      padding: '0 14px'
    }
  }
}

const OrganizationsSummaryCard = () => {
  const { data: organizations, isLoading } = useOrganizationNames()
  const { t } = useTranslation(['common', 'transaction'])
  const organizationList = useMemo(
    () => (Array.isArray(organizations) ? organizations : []),
    [organizations]
  )

  const [formattedOrgs, setFormattedOrgs] = useState([])
  const [selectedOrganization, setSelectedOrganization] = useState({
    name: t('txn:allOrganizations'),
    totalBalance: 0,
    reservedBalance: 0
  })

  useEffect(() => {
    if (!isLoading) {
      const formattedOrgs = organizationList.map((org) => ({
        name: org.name,
        totalBalance: org.totalBalance || 0,
        reservedBalance: Math.abs(org.reservedBalance || 0)
      }))

      setFormattedOrgs(formattedOrgs)
      setAllOrgSelected(organizationList)
    }
  }, [organizationList, isLoading])

  const onSelectOrganization = (event) => {
    const orgName = event.target.value
    if (orgName === t('txn:allOrganizations')) {
      setAllOrgSelected(organizationList)
    } else {
      const selectedOrg = formattedOrgs.find((org) => org.name === orgName)
      setSelectedOrganization(
        selectedOrg || {
          name: t('txn:allOrganizations'),
          totalBalance: 0,
          reservedBalance: 0
        }
      )
    }
  }

  const setAllOrgSelected = (orgs = organizationList) => {
    const totalBalance = orgs.reduce((total, org) => {
      return total + (org.totalBalance || 0)
    }, 0)
    const reservedBalance = orgs.reduce((total, org) => {
      return total + Math.abs(org.reservedBalance || 0)
    }, 0)

    setSelectedOrganization({
      name: t('txn:allOrganizations'),
      totalBalance,
      reservedBalance
    })
  }

  return (
    <BCWidgetCard
      component="div"
      title="Summary"
      sx={styles.cardContent}
      content={
        <Stack
          alignItems="center"
          sx={{ width: '100%' }}
        >
          <BCTypography
            variant="body2"
            sx={{ color: 'primary.main', mb: '2px' }}
          >
            {selectedOrganization.name}
          </BCTypography>
          <BCTypography
            variant="h3"
            component="span"
            sx={{ color: 'success.main' }}
          >
            {numberFormatter(selectedOrganization.totalBalance)}
          </BCTypography>
          <BCTypography
            variant="subtitle1"
            component="span"
            sx={{ color: 'primary.main' }}
          >
            compliance units
          </BCTypography>
          <BCTypography
            variant="h5"
            component="span"
            fontWeight="regular"
            sx={{ color: 'success.main', mt: 1 }}
          >
            ({numberFormatter(selectedOrganization.reservedBalance)} in reserve)
          </BCTypography>
          <BCTypography
            variant="body3"
            sx={{ color: 'primary.main', mt: 1 }}
          >
            Show balance for:
          </BCTypography>
          <Select
            defaultValue={t('txn:allOrganizations')}
            sx={styles.select}
            variant="outlined"
            onChange={onSelectOrganization}
            inputProps={{ 'aria-label': 'Select an organization' }}
          >
            <MenuItem key="default" value={t('txn:allOrganizations')}>
              {t('txn:allOrganizations')}
            </MenuItem>
            {!isLoading &&
              formattedOrgs.map((org, index) => (
                <MenuItem key={index} value={org.name}>
                  {org.name}
                </MenuItem>
              ))}
          </Select>
        </Stack>
      }
    />
  )
}

export default OrganizationsSummaryCard
