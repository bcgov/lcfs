import React, { useEffect, useState } from 'react'
import { Box, MenuItem, Select } from '@mui/material'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCTypography from '@/components/BCTypography'
import { useOrganizationNames } from '@/hooks/useOrganizations.js'
import { numberFormatter } from '@/utils/formatters.js'
import { useTranslation } from 'react-i18next'

const OrganizationsSummaryCard = () => {
  const { data: organizations, isLoading } = useOrganizationNames()
  const { t } = useTranslation(['common', 'transaction'])

  const [formattedOrgs, setFormattedOrgs] = useState([])
  const [selectedOrganization, setSelectedOrganization] = useState({
    name: t('txn:allOrganizations'),
    totalBalance: 0,
    reservedBalance: 0
  })

  useEffect(() => {
    if (!isLoading) {
      const formattedOrgs = organizations.map((org) => ({
        name: org.name,
        totalBalance: org.totalBalance,
        reservedBalance: Math.abs(org.reservedBalance)
      }))

      setFormattedOrgs(formattedOrgs)
      setAllOrgSelected()
    }
  }, [organizations, isLoading])

  const onSelectOrganization = (event) => {
    const orgName = event.target.value
    if (orgName === t('txn:allOrganizations')) {
      setAllOrgSelected()
    } else {
      const selectedOrg = formattedOrgs.find((org) => org.name === orgName)
      setSelectedOrganization(selectedOrg)
    }
  }

  const setAllOrgSelected = () => {
    const totalBalance = organizations.reduce((total, org) => {
      return total + org.totalBalance
    }, 0)
    const reservedBalance = organizations.reduce((total, org) => {
      return total + Math.abs(org.reservedBalance)
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
      disableHover={true}
      title="Summary"
      sx={{
        '& .MuiCardContent-root': { padding: '16px' },
        margin: '0 auto',
        maxWidth: '300px',
        boxShadow: 1
      }}
      content={
        <Box
          p={2}
          paddingTop={1}
          paddingBottom={1}
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          sx={{ width: '100%' }}
        >
          <BCTypography
            style={{ fontSize: '16px', color: '#003366', marginBottom: '2px' }}
          >
            {selectedOrganization.name}
          </BCTypography>
          <BCTypography
            style={{ fontSize: '32px', color: '#578260', marginBottom: '-2px' }}
            component="span"
          >
            {numberFormatter(selectedOrganization.totalBalance)}
          </BCTypography>
          <BCTypography
            style={{ fontSize: '18px', color: '#003366', marginBottom: '-4px' }}
            component="span"
          >
            compliance units
          </BCTypography>
          <Box display="flex" alignItems="center" mt={1}>
            <BCTypography
              style={{ fontSize: '22px', color: '#578260' }}
              component="span"
            >
              ({numberFormatter(selectedOrganization.reservedBalance)} in
              reserve)
            </BCTypography>
          </Box>
          <BCTypography
            style={{ fontSize: '14px', color: '#003366', marginTop: '6px' }}
          >
            Show balance for:
          </BCTypography>
          <Select
            defaultValue={t('txn:allOrganizations')}
            fullWidth
            sx={{
              marginTop: 1,
              padding: '8px',
              width: 'calc(100% - 20px)',
              bgcolor: 'background.paper',
              borderRadius: 1
            }}
            variant="outlined"
            onChange={onSelectOrganization}
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
        </Box>
      }
    />
  )
}

export default OrganizationsSummaryCard
