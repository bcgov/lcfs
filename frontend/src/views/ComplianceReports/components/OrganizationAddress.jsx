import React, { useEffect, useState } from 'react'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { useUpdateOrganizationSnapshot } from '@/hooks/useOrganizationSnapshot.js'
import { FormProvider, useForm } from 'react-hook-form'
import {
  BCFormText,
  BCFormAddressAutocomplete
} from '@/components/BCForm/index.js'
import { yupResolver } from '@hookform/resolvers/yup'
import { defaultValues } from '@/views/Users/AddEditUser/_schema.js'
import { Box, Stack, List, ListItem } from '@mui/material'
import BCButton from '@/components/BCButton/index.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons'
import * as Yup from 'yup'
import { PHONE_REGEX } from '@/constants/common.js'
import BCModal from '@/components/BCModal.jsx'

export const OrganizationAddress = ({
  snapshotData,
  complianceReportId,
  isEditing,
  setIsEditing
}) => {
  const { t } = useTranslation(['common', 'report', 'org'])
  const [modalData, setModalData] = useState(null)
  const [sameAsService, setSameAsService] = useState(false)
  const [selectedServiceAddress, setSelectedServiceAddress] = useState(null)

  const validationSchema = Yup.object({
    name: Yup.string().required('Legal name is required.'),
    operatingName: Yup.string().required('Operating name is required.'),
    phone: Yup.string()
      .required('Phone number is required.')
      .matches(PHONE_REGEX, 'Phone number is not valid'),
    email: Yup.string()
      .required('Email address is required.')
      .email('Please enter a valid email address.'),
    serviceAddress: Yup.string().required('Service Address is required.')
  })

  // Hook for updating the organization snapshot
  const { mutate: updateComplianceReport, isLoading: isUpdating } =
    useUpdateOrganizationSnapshot(complianceReportId)

  // Setting up the form
  const form = useForm({
    resolver: yupResolver(validationSchema),
    mode: 'onChange',
    defaultValues
  })
  const { handleSubmit, control, setValue, watch, reset } = form

  const serviceAddress = watch('serviceAddress')

  // If 'same as service address' is checked, automatically update records address
  useEffect(() => {
    if (sameAsService && serviceAddress) {
      setValue('recordsAddress', serviceAddress)
    }
  }, [sameAsService, serviceAddress, setValue])

  // Submission handlers
  const onSubmit = async (data) => {
    await updateComplianceReport(data)
    setIsEditing(false)
  }

  const onError = () => {
    const formData = form.getValues()
    setModalData({
      primaryButtonAction: async () => {
        await onSubmit(formData)
        setModalData(null)
      },
      primaryButtonText: 'Confirm',
      secondaryButtonText: t('cancelBtn'),
      title: 'Confirm Changes',
      content: (
        <Stack>
          <BCTypography mt={1} variant="body5">
            You will need to fill out all required fields to submit the
            Compliance Report. Are you sure you want to continue?
          </BCTypography>
        </Stack>
      )
    })
  }

  const onCancel = () => {
    reset(snapshotData)
    setIsEditing(false)
  }

  // Checkbox to keep records address synced with service address
  const handleSameAddressChange = (event) => {
    setSameAsService(event.target.checked)
    if (event.target.checked) {
      setValue('recordsAddress', serviceAddress)
    }
  }

  // Helpers to select addresses
  const handleSelectServiceAddress = (addressData) => {
    setSelectedServiceAddress(addressData)
    if (typeof addressData === 'string') {
      setValue('serviceAddress', addressData)
    } else {
      setValue('serviceAddress', addressData.fullAddress)
    }
    // If 'same as service address' is checked, automatically update records too
    if (sameAsService) {
      if (typeof addressData === 'string') {
        setValue('recordsAddress', addressData)
      } else {
        setValue('recordsAddress', addressData.fullAddress)
      }
    }
  }

  const handleSelectRecordsAddress = (addressData) => {
    if (typeof addressData === 'string') {
      setValue('recordsAddress', addressData)
    } else {
      setValue('recordsAddress', addressData.fullAddress)
    }
  }

  // Sync state with snapshot data on load
  useEffect(() => {
    if (snapshotData) {
      reset(snapshotData)
      setSameAsService(
        snapshotData.serviceAddress === snapshotData.recordsAddress
      )
    }
  }, [reset, snapshotData])

  // Required fields for the read-only view
  const requiredFields = [
    'name',
    'operatingName',
    'phone',
    'email',
    'serviceAddress'
  ]

  // Define which form fields use regular text input vs address autocomplete
  const textFormFields = [
    {
      name: 'name',
      label: t('org:legalNameLabel')
    },
    {
      name: 'operatingName',
      label: t('org:operatingNameLabel')
    },
    {
      name: 'phone',
      label: t('org:phoneNbrLabel')
    },
    {
      name: 'email',
      label: t('org:emailAddrLabel')
    },
    {
      name: 'headOfficeAddress',
      label: isEditing
        ? t('report:hoAddrLabelEdit')
        : t('report:hoAddrLabelView')
    }
  ]

  const addressFormFields = [
    {
      name: 'serviceAddress',
      label: t('report:serviceAddrLabel'),
      onSelectAddress: handleSelectServiceAddress
    },
    {
      name: 'recordsAddress',
      label: t('report:bcRecordLabel'),
      checkbox: true,
      checkboxLabel: 'Same as address for service',
      onCheckboxChange: handleSameAddressChange,
      isChecked: sameAsService,
      disabled: sameAsService,
      onSelectAddress: handleSelectRecordsAddress
    }
  ]

  // Merge text + address fields for read-only view
  const allFormFields = [...textFormFields, ...addressFormFields]

  // Helper to show either the value or 'Required' in read-only mode
  const displayAddressValue = (value) => (value?.trim() ? value : '')

  return (
    <BCTypography variant="body4" color="text">
      {!isEditing && (
        <List
          sx={{
            listStyleType: 'disc',
            listStylePosition: 'outside',
            pl: 2.5,
            '& .MuiListItem-root': {
              display: 'list-item',
              py: 0.5,
              paddingLeft: 0
            }
          }}
        >
          {allFormFields.map(({ name, label }) => (
            <ListItem key={name} sx={{ display: 'flex' }}>
              <strong>{label}:</strong>{' '}
              <span>
                {displayAddressValue(snapshotData[name]) ||
                  (requiredFields.includes(name) && (
                    <BCTypography variant="body4" color="error">
                      Required
                    </BCTypography>
                  ))}
              </span>
            </ListItem>
          ))}
        </List>
      )}

      {isEditing && (
        <form onSubmit={handleSubmit(onSubmit, onError)}>
          <FormProvider {...{ control, setValue }}>
            <Stack spacing={1} mb={3}>
              {/* Regular text fields */}
              {textFormFields.map((field) => (
                <BCFormText
                  data-test={field.name}
                  key={field.name}
                  control={control}
                  label={field.label}
                  name={field.name}
                />
              ))}

              {/* Address autocomplete fields */}
              {addressFormFields.map((field) => (
                <BCFormAddressAutocomplete
                  data-test={field.name}
                  key={field.name}
                  control={control}
                  label={field.label}
                  name={field.name}
                  checkbox={field.checkbox}
                  checkboxLabel={field.checkboxLabel}
                  onCheckboxChange={field.onCheckboxChange}
                  isChecked={field.isChecked}
                  disabled={field.disabled}
                  onSelectAddress={field.onSelectAddress}
                  optional={field.name !== 'serviceAddress'}
                />
              ))}
            </Stack>
            <Box display="flex">
              <BCButton
                type="submit"
                variant="contained"
                size="medium"
                color="primary"
                data-test="saveUser"
                isLoading={isUpdating}
                startIcon={
                  <FontAwesomeIcon icon={faFloppyDisk} className="small-icon" />
                }
              >
                <BCTypography variant="button">{t('saveBtn')}</BCTypography>
              </BCButton>
              <BCButton
                type="button"
                variant="outlined"
                color="primary"
                disabled={isUpdating}
                sx={{ ml: 2 }}
                onClick={onCancel}
              >
                <BCTypography variant="subtitle2" textTransform="none">
                  {t('cancelBtn')}
                </BCTypography>
              </BCButton>
            </Box>
          </FormProvider>
        </form>
      )}
      <BCModal
        open={!!modalData}
        onClose={() => setModalData(null)}
        data={modalData}
      />
    </BCTypography>
  )
}
