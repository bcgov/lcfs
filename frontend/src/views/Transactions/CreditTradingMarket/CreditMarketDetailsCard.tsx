import { useState, useEffect, useMemo, useCallback } from 'react'
import TextField from '@mui/material/TextField'
import '@mui/material/Grid'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import InputLabel from '@mui/material/InputLabel'
import { useForm, Controller } from 'react-hook-form'
import BCBox from '@/components/BCBox'
import BCTypography from '@/components/BCTypography'
import BCWidgetCard from '@/components/BCWidgetCard/BCWidgetCard'
import BCButton from '@/components/BCButton'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import {
  useOrganization,
  useUpdateCurrentOrgCreditMarket,
  useUpdateOrganizationCreditMarket
} from '@/hooks/useOrganization'
import { useQueryClient } from '@tanstack/react-query'
import { ORGANIZATION_STATUSES } from '@/constants/statuses'
import { roles, govRoles } from '@/constants/roles'
import Loading from '@/components/Loading'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFloppyDisk, faTimes } from '@fortawesome/free-solid-svg-icons'
import { phoneNumberFormatter } from '@/utils/formatters'

interface CreditMarketFormValues {
  contactName: string
  phone: string
  email: string
  isSeller: boolean
  isBuyer: boolean
  creditsToSell: number | string
  displayInMarket: boolean
}

interface CreditMarketDetailsCardProps {
  organizationId?: number | string
  variant?: 'self' | 'admin'
  onSaveSuccess?: () => void
}

export const CreditMarketDetailsCard = ({
  organizationId,
  variant = 'self',
  onSaveSuccess
}: CreditMarketDetailsCardProps) => {
  const { t } = useTranslation(['common', 'creditMarket', 'org'])
  const { data: currentUser, hasAnyRole } = useCurrentUser()
  const queryClient = useQueryClient()
  const [isEditMode, setIsEditMode] = useState(false)

  const targetOrgId =
    organizationId ?? currentUser?.organization?.organizationId

  // Get full organization data
  const organizationQueryOptions = {
    enabled: !!targetOrgId,
    staleTime: 0,
    cacheTime: 0
  }
  const { data: organizationData, isLoading } = useOrganization(
    targetOrgId,
    organizationQueryOptions
  )

  // Shared mutation options for both BCeID and IDIR flows
  const mutationOptions = useMemo(
    () => ({
      clearCache: true,
      invalidateRelatedQueries: true,
      onSuccess: async () => {
        if (targetOrgId) {
          await queryClient.refetchQueries({
            queryKey: ['organization', targetOrgId]
          })
        }
        setIsEditMode(false)
        onSaveSuccess?.()
      },
      onError: (error: Error) => {
        console.error('Failed to update credit market details:', error)
      }
    }),
    [onSaveSuccess, queryClient, targetOrgId]
  )

  // Instantiate both mutations so hook order stays stable
  const updateCurrentOrgMutation =
    useUpdateCurrentOrgCreditMarket(mutationOptions)
  const updateOrganizationMutation = useUpdateOrganizationCreditMarket(
    targetOrgId,
    mutationOptions
  )

  const updateCreditMarket =
    variant === 'admin' ? updateOrganizationMutation : updateCurrentOrgMutation

  // Form setup for edit mode
  const initialFormValues = useMemo(
    () => ({
      contactName: '',
      phone: '',
      email: '',
      isSeller: false,
      isBuyer: false,
      creditsToSell: 0,
      displayInMarket: false
    }),
    []
  )

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
    watch
  } = useForm<CreditMarketFormValues>({
    defaultValues: initialFormValues
  })

  const getOrgValue = useCallback(
    (...keys: string[]): unknown => {
      if (!organizationData) return undefined
      for (const key of keys) {
        if (
          Object.prototype.hasOwnProperty.call(organizationData, key) &&
          organizationData[key] !== undefined
        ) {
          return organizationData[key]
        }
      }
      return undefined
    },
    [organizationData]
  )

  const getOrgStringValue = useCallback(
    (...keys: string[]): string | undefined => {
      const value = getOrgValue(...keys)
      return typeof value === 'string' ? value : undefined
    },
    [getOrgValue]
  )

  const getOrgNumberOrStringValue = useCallback(
    (...keys: string[]): number | string | undefined => {
      const value = getOrgValue(...keys)
      return typeof value === 'number' || typeof value === 'string'
        ? value
        : undefined
    },
    [getOrgValue]
  )

  const getOrgBooleanValue = useCallback(
    (...keys: string[]): boolean => Boolean(getOrgValue(...keys)),
    [getOrgValue]
  )

  const getOrgStatusValue = useCallback(
    (...keys: string[]): string | undefined => {
      const value = getOrgValue(...keys)
      if (value && typeof value === 'object' && 'status' in value) {
        return typeof value.status === 'string' ? value.status : undefined
      }
      return undefined
    },
    [getOrgValue]
  )

  const buildFormValues = useCallback(() => {
    const defaultName =
      variant === 'self'
        ? `${currentUser?.firstName || ''} ${
            currentUser?.lastName || ''
          }`.trim()
        : ''
    return {
      contactName:
        getOrgStringValue(
          'creditMarketContactName',
          'credit_market_contact_name'
        ) || defaultName,
      phone:
        getOrgStringValue(
          'creditMarketContactPhone',
          'credit_market_contact_phone',
          'phone'
        ) || '',
      email:
        getOrgStringValue(
          'creditMarketContactEmail',
          'credit_market_contact_email',
          'email'
        ) || '',
      isSeller: getOrgBooleanValue(
        'creditMarketIsSeller',
        'credit_market_is_seller'
      ),
      isBuyer: getOrgBooleanValue(
        'creditMarketIsBuyer',
        'credit_market_is_buyer'
      ),
      creditsToSell:
        getOrgNumberOrStringValue('creditsToSell', 'credits_to_sell') ?? 0,
      displayInMarket: getOrgBooleanValue(
        'displayInCreditMarket',
        'display_in_credit_market'
      )
    }
  }, [
    currentUser,
    getOrgBooleanValue,
    getOrgNumberOrStringValue,
    getOrgStringValue,
    variant
  ])

  // Update form when organization data or user context changes
  useEffect(() => {
    if (organizationData || (variant === 'self' && currentUser)) {
      reset(buildFormValues())
      setIsEditMode(false)
    }
  }, [organizationData, currentUser, variant, buildFormValues, reset])

  // Watch the seller checkbox to conditionally enable credits field
  const isSeller = watch('isSeller')

  // Get the available balance for validation
  const availableBalanceValue = getOrgValue('totalBalance', 'total_balance')
  const availableBalance =
    typeof availableBalanceValue === 'number'
      ? availableBalanceValue
      : typeof availableBalanceValue === 'string'
        ? Number(availableBalanceValue)
        : 0

  const organizationDisplayName =
    getOrgStringValue('organizationName', 'organization_name', 'name') || ''

  const baseCardTitle = t(
    'creditMarket:marketDetails',
    'Credit trading market details'
  )
  const cardTitle =
    variant === 'admin' && organizationDisplayName
      ? `${baseCardTitle} - ${organizationDisplayName}`
      : baseCardTitle
  const readOnlyValues = buildFormValues()

  if (variant === 'admin' && !organizationId) {
    return null
  }

  if (isLoading) {
    return <Loading />
  }

  const orgStatusValue =
    getOrgStatusValue('orgStatus') || getOrgStatusValue('org_status')

  const isRegistered = orgStatusValue === ORGANIZATION_STATUSES.REGISTERED

  // Check if user has the required roles for editing
  const hasEditPermission =
    variant === 'admin'
      ? hasAnyRole(...govRoles)
      : hasAnyRole(roles.transfers, roles.signing_authority)

  // Handlers for edit mode
  const handleEdit = () => {
    setIsEditMode(true)
  }

  const handleCancel = () => {
    setIsEditMode(false)
    reset() // Reset form to original values
  }

  const handleSave = (data: CreditMarketFormValues) => {
    // Prepare the update payload with only credit market fields
    const updatePayload = {
      credit_market_contact_name: data.contactName,
      credit_market_contact_email: data.email,
      credit_market_contact_phone: data.phone,
      credit_market_is_seller: data.isSeller,
      credit_market_is_buyer: data.isBuyer,
      // Set credits to sell to 0 if not a seller, otherwise use the entered value (ensure it's a number)
      credits_to_sell: data.isSeller
        ? parseInt(String(data.creditsToSell), 10) || 0
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
          title={cardTitle}
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
              {variant === 'admin' && (
                <BCBox mb={2}>
                  <BCTypography variant="body4">
                    <strong>
                      {t(
                        'creditMarket:selectedOrganization',
                        'Selected organization'
                      )}
                      :
                    </strong>{' '}
                    {organizationDisplayName ||
                      t('common:notAvailable', 'Not available')}
                  </BCTypography>
                </BCBox>
              )}
              {isEditMode ? (
                // Edit Mode Form
                <form onSubmit={handleSubmit(handleSave)}>
                  <BCBox
                    display="grid"
                    gridTemplateColumns={{ xs: '1fr', md: '1fr 1.5fr' }}
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
                    gridTemplateColumns={{ xs: '1fr', md: '1fr 1.5fr' }}
                    columnGap={10}
                    rowGap={2}
                  >
                    {/* Left Column */}
                    <BCBox display="flex" flexDirection="column" gap={2}>
                      <BCTypography variant="body4">
                        <strong>
                          {t('creditMarket:contactName', 'Contact name')}:
                        </strong>{' '}
                        {readOnlyValues.contactName ||
                          t('common:notAvailable', 'Not available')}
                      </BCTypography>

                      <BCTypography variant="body4">
                        <strong>
                          {t('creditMarket:telephone', 'Telephone')}:
                        </strong>{' '}
                        {phoneNumberFormatter({
                          value: readOnlyValues.phone
                        }) || t('common:notAvailable', 'Not available')}
                      </BCTypography>

                      <BCTypography variant="body4">
                        <strong>{t('creditMarket:email', 'Email')}:</strong>{' '}
                        {readOnlyValues.email ||
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
                          const displayRoles = []
                          if (
                            getOrgBooleanValue(
                              'creditMarketIsSeller',
                              'credit_market_is_seller'
                            )
                          ) {
                            displayRoles.push(
                              t('creditMarket:seller', 'Seller')
                            )
                          }
                          if (
                            getOrgBooleanValue(
                              'creditMarketIsBuyer',
                              'credit_market_is_buyer'
                            )
                          ) {
                            displayRoles.push(t('creditMarket:buyer', 'Buyer'))
                          }
                          return displayRoles.length > 0
                            ? displayRoles.join(', ')
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
                        {getOrgBooleanValue(
                          'displayInCreditMarket',
                          'display_in_credit_market'
                        )
                          ? t('common:yes')
                          : t('common:no')}
                      </BCTypography>

                      <BCTypography variant="body4">
                        <strong>
                          {t('creditMarket:creditsToSell', 'Credits to sell')}:
                        </strong>{' '}
                        {getOrgNumberOrStringValue(
                          'creditsToSell',
                          'credits_to_sell'
                        ) ?? 0}
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
