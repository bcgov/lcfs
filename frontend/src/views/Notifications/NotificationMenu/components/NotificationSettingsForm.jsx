import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useForm, FormProvider, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  Checkbox,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  InputLabel
} from '@mui/material'
import { yupResolver } from '@hookform/resolvers/yup'
import * as Yup from 'yup'
import Loading from '@/components/Loading'
import {
  useNotificationSubscriptions,
  useCreateSubscription,
  useDeleteSubscription,
  useUpdateNotificationsEmail
} from '@/hooks/useNotifications'
import {
  notificationTypes,
  notificationChannels
} from '@/constants/notificationTypes'
import BCButton from '@/components/BCButton'
import BCBox from '@/components/BCBox'
import BCAlert from '@/components/BCAlert'
import BCTypography from '@/components/BCTypography'
import { Mail, Notifications } from '@mui/icons-material'

const NotificationSettingsForm = ({
  categories,
  showEmailField = false,
  initialEmail = ''
}) => {
  const { t } = useTranslation(['notifications'])
  const [isFormLoading, setIsFormLoading] = useState(false)
  const [message, setMessage] = useState('')
  const { data: subscriptionsData, isLoading: isSubscriptionsLoading } =
    useNotificationSubscriptions()
  const createSubscription = useCreateSubscription()
  const deleteSubscription = useDeleteSubscription()
  const updateEmail = useUpdateNotificationsEmail()

  // Validation schema
  const validationSchema = Yup.object().shape({
    ...(showEmailField && {
      email: Yup.string()
        .email(t('errors.invalidEmail'))
        .required(t('errors.emailRequired'))
    })
  })

  const formMethods = useForm({
    resolver: yupResolver(validationSchema),
    mode: 'onChange'
  })

  const { handleSubmit, control, setValue } = formMethods

  useEffect(() => {
    if (subscriptionsData) {
      subscriptionsData.forEach((subscription) => {
        const { notificationTypeName, notificationChannelName, isEnabled } =
          subscription
        const fieldName = `${notificationTypeName}_${notificationChannelName}`
        setValue(fieldName, isEnabled)
      })
    }
    if (showEmailField && initialEmail) {
      setValue('email', initialEmail)
    }
  }, [subscriptionsData, showEmailField, initialEmail, setValue])

  const handleCheckboxChange = async (
    notificationTypeName,
    notificationChannelName,
    isChecked
  ) => {
    setIsFormLoading(true)
    setMessage('') // Clear any existing messages
    try {
      if (isChecked) {
        // Create the subscription
        await createSubscription.mutateAsync({
          notificationTypeName,
          notificationChannelName,
          isEnabled: true
        })
      } else {
        // Find the subscription ID
        const subscription = subscriptionsData.find(
          (sub) =>
            sub.notificationTypeName === notificationTypeName &&
            sub.notificationChannelName === notificationChannelName
        )
        if (subscription) {
          // Delete the subscription
          await deleteSubscription.mutateAsync(
            subscription.notificationChannelSubscriptionId
          )
        }
      }
      setMessage(t('messages.subscriptionUpdated'))
    } catch (error) {
      setMessage(t('errors.operationFailed'))
    } finally {
      setIsFormLoading(false)
    }
  }

  const onSubmit = async (data) => {
    setIsFormLoading(true)
    setMessage('') // Clear any existing messages
    try {
      if (showEmailField) {
        // BCeID user, save the email address
        await updateEmail.mutateAsync({
          email: data.email
        })
        setMessage(t('messages.emailSaved'))
      }
    } catch (err) {
      setMessage(t('errors.operationFailed'))
    } finally {
      setIsFormLoading(false)
    }
  }

  if (isSubscriptionsLoading) {
    return <Loading message={t('loading.notificationSettings')} />
  }

  return (
    <FormProvider {...formMethods}>
      {isFormLoading && (
        <Loading message={t('loading.savingPreferences')} fixed={true} />
      )}

      <BCTypography variant="h5" color="primary" mb={2}>
        {t('title.ConfigureNotifications')}
      </BCTypography>

      <BCBox
        sx={{
          position: 'relative',
          padding: 2,
          border: '1px solid #c0c0c0'
        }}
      >
        <BCBox
          sx={{
            position: {
              xs: 'relative', // On mobile devices, use relative positioning
              md: 'absolute' // On medium and larger screens, use absolute positioning
            },
            top: {
              md: 0 // Apply top positioning only on medium and larger screens
            },
            right: {
              md: 0 // Apply right positioning only on medium and larger screens
            },
            paddingTop: {
              xs: 0, // Reduce padding on mobile devices
              md: 4 // Default padding on larger screens
            },
            paddingRight: {
              xs: 0, // Remove right padding on mobile devices
              md: 3 // Default right padding on larger screens
            },
            width: {
              xs: '100%', // Full width on mobile devices
              md: 'auto' // Automatic width on larger screens
            },
            textAlign: {
              xs: 'left', // Left-align text on mobile devices
              md: 'right' // Right-align text on larger screens
            }
          }}
        >
          <BCBox
            sx={{
              display: 'flex',
              flexDirection: {
                xs: 'column', // Column layout on mobile devices
                md: 'column' // Column layout on larger screens
              },
              justifyContent: 'flex-end',
              alignItems: 'flex-start',
              gap: 2,
              mt: {
                xs: 0, // Margin-top on mobile devices
                md: 0
              },
              mb: {
                xs: 4
              }
            }}
          >
            {/* Email Notification */}
            <BCBox
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mx: {
                  xs: 1, // Horizontal margin on mobile devices
                  md: 0
                }
              }}
            >
              <Mail sx={{ color: '#547D59', width: '22px', height: '22px' }} />
              <BCTypography variant="body2" sx={{ color: 'text.primary' }}>
                {t('emailNotification')}
              </BCTypography>
            </BCBox>

            {/* In-App Notification */}
            <BCBox
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mx: {
                  xs: 1,
                  md: 0
                }
              }}
            >
              <Notifications
                sx={{ color: '#547D59', width: '22px', height: '22px' }}
              />
              <BCTypography variant="body2" sx={{ color: 'text.primary' }}>
                {t('inAppNotification')}
              </BCTypography>
            </BCBox>
          </BCBox>
        </BCBox>

        <form onSubmit={handleSubmit(onSubmit)}>
          <TableContainer sx={{ boxShadow: 'none', borderRadius: 0 }}>
            <Table sx={{ border: 'none' }}>
              <TableBody>
                {Object.entries(categories).map(
                  ([categoryKey, category], index) => (
                    <React.Fragment key={categoryKey}>
                      {/* Category Header */}
                      <TableRow>
                        <TableCell
                          align="center"
                          sx={{
                            bgcolor: '#f2f2f2',
                            borderBottom: 'none',
                            padding: '4px',
                            paddingTop: index === 0 ? 1 : 4
                          }}
                        >
                          <Mail
                            style={{
                              color: '#547D59',
                              width: '22px',
                              height: '22px'
                            }}
                          />
                        </TableCell>
                        <TableCell
                          align="center"
                          sx={{
                            bgcolor: '#f2f2f2',
                            borderBottom: 'none',
                            padding: '4px',
                            paddingTop: index === 0 ? 1 : 4
                          }}
                        >
                          <Notifications
                            style={{
                              color: '#547D59',
                              width: '22px',
                              height: '22px'
                            }}
                          />
                        </TableCell>
                        <TableCell
                          sx={{
                            borderBottom: 'none',
                            padding: '4px 4px 4px 14px',
                            paddingTop: index === 0 ? 1 : 4
                          }}
                        >
                          <BCTypography
                            variant="h6"
                            sx={{ fontWeight: 'bold' }}
                          >
                            {t(`${categoryKey}.title`)}
                          </BCTypography>
                        </TableCell>
                      </TableRow>
                      {/* Notifications */}
                      {Object.entries(category)
                        .filter(([key]) => key !== 'title')
                        .map(([notificationTypeName, notificationLabelKey]) => {
                          const notificationTypeKey = notificationTypeName
                          const notificationTypeId =
                            notificationTypes[notificationTypeName]
                          if (!notificationTypeId) return null

                          return (
                            <TableRow key={notificationTypeName}>
                              {/* Email Checkbox */}
                              <TableCell
                                align="center"
                                sx={{
                                  bgcolor: '#f2f2f2',
                                  borderBottom: 'none',
                                  padding: '4px'
                                }}
                              >
                                <Controller
                                  name={`${notificationTypeKey}_${notificationChannels.EMAIL}`}
                                  control={control}
                                  defaultValue={false}
                                  render={({ field }) => (
                                    <Checkbox
                                      {...field}
                                      checked={field.value}
                                      onChange={(e) => {
                                        field.onChange(e)
                                        handleCheckboxChange(
                                          notificationTypeKey,
                                          notificationChannels.EMAIL,
                                          e.target.checked
                                        )
                                      }}
                                      color="primary"
                                      disabled={isFormLoading} // Disable during loading
                                    />
                                  )}
                                />
                              </TableCell>
                              {/* In-App Checkbox */}
                              <TableCell
                                align="center"
                                sx={{
                                  bgcolor: '#f2f2f2',
                                  borderBottom: 'none',
                                  padding: '4px'
                                }}
                              >
                                <Controller
                                  name={`${notificationTypeKey}_${notificationChannels.IN_APP}`}
                                  control={control}
                                  defaultValue={false}
                                  render={({ field }) => (
                                    <Checkbox
                                      {...field}
                                      checked={field.value}
                                      onChange={(e) => {
                                        field.onChange(e)
                                        handleCheckboxChange(
                                          notificationTypeKey,
                                          notificationChannels.IN_APP,
                                          e.target.checked
                                        )
                                      }}
                                      color="primary"
                                      disabled={isFormLoading} // Disable during loading
                                    />
                                  )}
                                />
                              </TableCell>
                              {/* Label */}
                              <TableCell
                                sx={{
                                  borderBottom: 'none',
                                  padding: '6px 4px 4px 14px'
                                }}
                              >
                                {t(notificationLabelKey)}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                    </React.Fragment>
                  )
                )}
                {/* Submit Button and Email Field */}
                <TableRow>
                  <TableCell
                    colSpan={2}
                    align="center"
                    sx={{
                      bgcolor: '#f2f2f2',
                      borderBottom: 'none',
                      padding: '10px'
                    }}
                  >
                    {showEmailField && (
                      <BCButton
                        type="submit"
                        variant="contained"
                        size="medium"
                        color="primary"
                        sx={{ marginTop: 5, marginBottom: 3 }}
                        disabled={isFormLoading}
                      >
                        {t('saveButton')}
                      </BCButton>
                    )}
                  </TableCell>
                  <TableCell
                    sx={{
                      borderBottom: 'none'
                    }}
                  >
                    {showEmailField && (
                      <BCBox sx={{ marginTop: 2 }}>
                        <InputLabel htmlFor="email" sx={{ pb: 1 }}>
                          {t('email')}:
                        </InputLabel>
                        <Controller
                          name="email"
                          control={control}
                          defaultValue=""
                          render={({ field, fieldState: { error } }) => (
                            <TextField
                              {...field}
                              value={field.value || ''}
                              error={!!error}
                              helperText={error ? error.message : ''}
                              fullWidth
                              disabled={isFormLoading} // Disable during loading
                            />
                          )}
                        />
                      </BCBox>
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </form>
      </BCBox>

      {/* Success/Error Message */}
      {message && (
        <BCBox sx={{ mt: 2 }}>
          <BCAlert
            severity={
              message === t('errors.operationFailed') ? 'error' : 'success'
            }
          >
            {message}
          </BCAlert>
        </BCBox>
      )}
    </FormProvider>
  )
}

NotificationSettingsForm.propTypes = {
  categories: PropTypes.object.isRequired,
  showEmailField: PropTypes.bool,
  initialEmail: PropTypes.string
}

export default NotificationSettingsForm
