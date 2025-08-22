import React, { useState, useEffect } from 'react'
import {
  TextField,
  Grid,
  FormControlLabel,
  Checkbox,
  InputLabel
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCButton from '@/components/BCButton'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useOrganization,
  useUpdateCurrentOrgCreditMarket
} from '@/hooks/useOrganization'
import { useQueryClient } from '@tanstack/react-query'
import { ORGANIZATION_STATUSES } from '@/constants/statuses'
import { roles } from '@/constants/roles'
import Loading from '@/components/Loading'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFloppyDisk, faTimes } from '@fortawesome/free-solid-svg-icons'

export const CreditMarketDetailsCard = () => {
  const { t } = useTranslation(['common', 'creditMarket', 'org'])
  const { data: currentUser } = useCurrentUser()
  const queryClient = useQueryClient()
  const [isEditMode, setIsEditMode] = useState(false)

  // Get full organization data
  const { data: organizationData, isLoading } = useOrganization(
    currentUser?.organization?.organizationId,
    {
      enabled: !!currentUser?.organization?.organizationId,
      staleTime: 0,
      cacheTime: 0
    }
  )

  // Mutation hook for updating credit market details
  const updateCreditMarket = useUpdateCurrentOrgCreditMarket({
    clearCache: true, // Force cache refresh to get updated data
    invalidateRelatedQueries: true, // Invalidate to force refetch
    onSuccess: async (data) => {
      // Force a fresh fetch of organization data
      const orgId = currentUser?.organization?.organizationId
      if (orgId) {
        await queryClient.refetchQueries(['organization', orgId])
      }

      setIsEditMode(false)
      // Show success message if you have a toast/notification system
    },
    onError: (error) => {
      console.error('Failed to update credit market details:', error)
      // Show error message if you have a toast/notification system
    }
  })

  // Form setup for edit mode
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
    watch
  } = useForm({
    defaultValues: {
      contactName:
        organizationData?.credit_market_contact_name ||
        `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim(),
      phone:
        organizationData?.credit_market_contact_phone ||
        organizationData?.phone ||
        '',
      email:
        organizationData?.credit_market_contact_email ||
        organizationData?.email ||
        '',
      isSeller: organizationData?.credit_market_is_seller || false,
      isBuyer: organizationData?.credit_market_is_buyer || false,
      creditsToSell: organizationData?.creditsToSell || 0,
      displayInMarket: organizationData?.display_in_credit_market || false
    }
  })

  // Update form when organization data loads
  useEffect(() => {
    if (organizationData && currentUser) {
      reset({
        contactName:
          organizationData?.creditMarketContactName ||
          `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim(),
        phone:
          organizationData?.creditMarketContactPhone ||
          organizationData?.phone ||
          '',
        email:
          organizationData?.creditMarketContactEmail ||
          organizationData?.email ||
          '',
        isSeller: organizationData?.creditMarketIsSeller || false,
        isBuyer: organizationData?.creditMarketIsBuyer || false,
        creditsToSell: organizationData?.creditsToSell || 0,
        displayInMarket: organizationData?.displayInCreditMarket || false
      })
    }
  }, [organizationData, currentUser, reset])

  // Watch the seller checkbox to conditionally enable credits field
  const isSeller = watch('isSeller')

  // Get the available balance for validation
  const availableBalance =
    organizationData?.totalBalance || organizationData?.total_balance || 0

  if (isLoading) {
    return <Loading />
  }

  const isRegistered =
    organizationData?.orgStatus?.status === ORGANIZATION_STATUSES.REGISTERED

  // Check if user has Transfer or Signing Authority roles (required for editing)
  const hasEditPermission = currentUser?.roles?.some(
    (role) =>
      role.name === roles.transfers || role.name === roles.signing_authority
  )

  // Handlers for edit mode
  const handleEdit = () => {
    setIsEditMode(true)
  }

  const handleCancel = () => {
    setIsEditMode(false)
    reset() // Reset form to original values
  }

  const handleSave = (data) => {
    // Prepare the update payload with only credit market fields
    const updatePayload = {
      credit_market_contact_name: data.contactName,
      credit_market_contact_email: data.email,
      credit_market_contact_phone: data.phone,
      credit_market_is_seller: data.isSeller,
      credit_market_is_buyer: data.isBuyer,
      // Set credits to sell to 0 if not a seller, otherwise use the entered value (ensure it's a number)
      credits_to_sell: data.isSeller
        ? parseInt(data.creditsToSell, 10) || 0
        : 0,
      display_in_credit_market: data.displayInMarket
    }

    updateCreditMarket.mutate(updatePayload)
  }

  return (
    <BCBox>
      <BCBox
        sx={{
          width: {
            md: '100%',
            lg: '50%'
          }
        }}
      >
        <BCWidgetCard
          title={t(
            'creditMarket:marketDetails',
            'Credit trading market details'
          )}
          color="nav"
          editButton={
            !isEditMode && hasEditPermission
              ? {
                  text: t('org:editBtn', 'Edit'),
                  onClick: handleEdit,
                  id: 'edit-credit-market-details-button'
                }
              : undefined
          }
          content={
            <BCBox p={1}>
              {isEditMode ? (
                // Edit Mode Form
                <form onSubmit={handleSubmit(handleSave)}>
                  <BCBox
                    display="grid"
                    gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }}
                    columnGap={10}
                    rowGap={2}
                  >
                    {/* Left Column - Editable Fields */}
                    <BCBox display="flex" flexDirection="column" gap={2}>
                      <BCBox>
                        <InputLabel htmlFor="contactName" sx={{ pb: 1 }}>
                          {t('creditMarket:contactName', 'Contact name')}:
                        </InputLabel>
                        <Controller
                          name="contactName"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              id="contactName"
                              fullWidth
                              variant="outlined"
                              size="small"
                            />
                          )}
                        />
                      </BCBox>

                      <BCBox>
                        <InputLabel htmlFor="phone" sx={{ pb: 1 }}>
                          {t('creditMarket:telephone', 'Telephone')}:
                        </InputLabel>
                        <Controller
                          name="phone"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              id="phone"
                              fullWidth
                              variant="outlined"
                              size="small"
                            />
                          )}
                        />
                      </BCBox>

                      <BCBox>
                        <InputLabel htmlFor="email" sx={{ pb: 1 }}>
                          {t('creditMarket:email', 'Email')}:
                        </InputLabel>
                        <Controller
                          name="email"
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              id="email"
                              fullWidth
                              variant="outlined"
                              size="small"
                              type="email"
                            />
                          )}
                        />
                      </BCBox>
                    </BCBox>

                    {/* Right Column - Checkboxes and Credits */}
                    <BCBox
                      display="flex"
                      flexDirection="column"
                      gap={2}
                      alignItems="center"
                    >
                      <Controller
                        name="isSeller"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={
                              <Checkbox
                                {...field}
                                checked={field.value}
                                size="small"
                              />
                            }
                            label={
                              <BCTypography variant="body4">
                                {t('creditMarket:seller', 'Seller')}
                              </BCTypography>
                            }
                            labelPlacement="start"
                          />
                        )}
                      />

                      <Controller
                        name="isBuyer"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={
                              <Checkbox
                                {...field}
                                checked={field.value}
                                size="small"
                              />
                            }
                            label={
                              <BCTypography variant="body4">
                                {t('creditMarket:buyer', 'Buyer')}
                              </BCTypography>
                            }
                            labelPlacement="start"
                          />
                        )}
                      />

                      <BCBox>
                        <InputLabel htmlFor="creditsToSell" sx={{ pb: 1 }}>
                          {t('creditMarket:amountCreditsToSell')}:
                        </InputLabel>
                        <Controller
                          name="creditsToSell"
                          control={control}
                          rules={{
                            required: isSeller
                              ? 'Credits to sell is required when seller is selected'
                              : false,
                            min: {
                              value: 0,
                              message: 'Credits to sell cannot be negative'
                            },
                            max: {
                              value: availableBalance,
                              message: `Credits to sell cannot exceed available balance (${availableBalance})`
                            }
                          }}
                          render={({ field, fieldState: { error } }) => (
                            <TextField
                              {...field}
                              id="creditsToSell"
                              fullWidth
                              variant="outlined"
                              size="small"
                              type="number"
                              inputProps={{
                                min: 0,
                                max: availableBalance
                              }}
                              disabled={!isSeller}
                              error={!!error}
                              helperText={error?.message}
                            />
                          )}
                        />
                      </BCBox>

                      <Controller
                        name="displayInMarket"
                        control={control}
                        render={({ field }) => (
                          <FormControlLabel
                            control={
                              <Checkbox
                                {...field}
                                checked={field.value}
                                size="small"
                              />
                            }
                            label={
                              <BCTypography variant="body4">
                                {t('creditMarket:displayInMarket')}
                              </BCTypography>
                            }
                            labelPlacement="start"
                          />
                        )}
                      />
                    </BCBox>
                  </BCBox>

                  {/* Action Buttons */}
                  <BCBox display="flex" gap={2} mt={3}>
                    <BCButton
                      variant="contained"
                      color="primary"
                      type="submit"
                      disabled={!isDirty || updateCreditMarket.isPending}
                      startIcon={<FontAwesomeIcon icon={faFloppyDisk} />}
                    >
                      {updateCreditMarket.isPending
                        ? t('common:saving', 'Saving...')
                        : t('common:save', 'Save')}
                    </BCButton>
                    <BCButton
                      variant="outlined"
                      color="primary"
                      onClick={handleCancel}
                      disabled={updateCreditMarket.isPending}
                      startIcon={<FontAwesomeIcon icon={faTimes} />}
                    >
                      {t('common:cancel', 'Cancel')}
                    </BCButton>
                  </BCBox>
                </form>
              ) : (
                // Read-only View
                <>
                  <BCBox
                    display="grid"
                    gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }}
                    columnGap={10}
                    rowGap={2}
                  >
                    {/* Left Column */}
                    <BCBox display="flex" flexDirection="column" gap={2}>
                      <BCTypography variant="body4">
                        <strong>
                          {t('creditMarket:contactName', 'Contact name')}:
                        </strong>{' '}
                        {organizationData?.creditMarketContactName ||
                          (currentUser?.firstName && currentUser?.lastName
                            ? `${currentUser.firstName} ${currentUser.lastName}`
                            : t('common:notAvailable', 'Not available'))}
                      </BCTypography>

                      <BCTypography variant="body4">
                        <strong>{t('creditMarket:email', 'Email')}:</strong>{' '}
                        {organizationData?.creditMarketContactEmail ||
                          organizationData?.email ||
                          t('common:notAvailable', 'Not available')}
                      </BCTypography>

                      <BCTypography variant="body4">
                        <strong>
                          {t('creditMarket:telephone', 'Telephone')}:
                        </strong>{' '}
                        {organizationData?.creditMarketContactPhone ||
                          organizationData?.phone ||
                          t('common:notAvailable', 'Not available')}
                      </BCTypography>
                    </BCBox>

                    {/* Right Column */}
                    <BCBox display="flex" flexDirection="column" gap={2}>
                      <BCTypography variant="body4">
                        <strong>
                          {t('creditMarket:roleInMarket', 'Role in Market')}:
                        </strong>{' '}
                        {(() => {
                          const roles = []
                          if (organizationData?.creditMarketIsSeller)
                            roles.push(t('creditMarket:seller', 'Seller'))
                          if (organizationData?.creditMarketIsBuyer)
                            roles.push(t('creditMarket:buyer', 'Buyer'))
                          return roles.length > 0
                            ? roles.join(', ')
                            : t('common:notAvailable', 'Not available')
                        })()}
                      </BCTypography>

                      <BCTypography variant="body4">
                        <strong>
                          {t(
                            'creditMarket:displayInMarket',
                            'Display in Credit trading market'
                          )}
                          :
                        </strong>{' '}
                        {organizationData?.displayInCreditMarket ||
                        organizationData?.display_in_credit_market
                          ? t('common:yes')
                          : t('common:no')}
                      </BCTypography>

                      <BCTypography variant="body4">
                        <strong>
                          {t('creditMarket:creditsToSell', 'Credits to sell')}:
                        </strong>{' '}
                        {organizationData?.creditsToSell || 0}
                      </BCTypography>
                    </BCBox>
                  </BCBox>

                  {!isRegistered &&
                    !updateCreditMarket.isPending &&
                    organizationData && (
                      <BCBox
                        mt={2}
                        p={2}
                        sx={{ bgcolor: 'warning.light', borderRadius: 1 }}
                      >
                        <BCTypography variant="body4" color="warning.dark">
                          <strong>
                            {t('creditMarket:eligibilityNote', 'Note')}:
                          </strong>{' '}
                          {t(
                            'creditMarket:requiresRegistration',
                            'Your organization must be registered for transfers to participate in the credit trading market.'
                          )}
                        </BCTypography>
                      </BCBox>
                    )}
                </>
              )}
            </BCBox>
          }
        />
      </BCBox>
    </BCBox>
  )
}
