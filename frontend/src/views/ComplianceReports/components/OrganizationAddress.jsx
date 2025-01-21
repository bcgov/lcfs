import React, { useEffect, useState } from 'react'
import BCTypography from '@/components/BCTypography'
import { useTranslation } from 'react-i18next'
import { useUpdateOrganizationSnapshot } from '@/hooks/useOrganizationSnapshot.js'
import { FormProvider, useForm } from 'react-hook-form'
import { BCFormText } from '@/components/BCForm/index.js'
import { yupResolver } from '@hookform/resolvers/yup'
import { defaultValues } from '@/views/Users/AddEditUser/_schema.js'
import { Box, Stack } from '@mui/material'
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

  const validationSchema = Yup.object({
    name: Yup.string().required('Legal name is required.'),
    operatingName: Yup.string().required('Operating name is required.'),
    phone: Yup.string()
      .required('Phone number is required.')
      .matches(PHONE_REGEX, 'Phone number is not valid'),
    email: Yup.string()
      .required('Email address is required.')
      .email('Please enter a valid email address.'),
    serviceAddress: Yup.string().required('Service Address is required.'),
    bcAddress: Yup.string().required('B.C. Address is required.')
  })

  const formFields = (t) => [
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
      name: 'serviceAddress',
      label: t('report:serviceAddrLabel')
    },
    {
      name: 'bcAddress',
      label: t('report:bcAddrLabel')
    }
  ]

  const { mutate: updateComplianceReport, isLoading: isUpdating } =
    useUpdateOrganizationSnapshot(complianceReportId)

  // User form hook and form validation
  const form = useForm({
    resolver: yupResolver(validationSchema),
    mode: 'onChange',
    defaultValues
  })
  const { handleSubmit, control, setValue, watch, reset } = form

  const onSubmit = async (data) => {
    await updateComplianceReport(data)
    setIsEditing(false)
  }

  useEffect(() => {
    if (snapshotData) {
      reset(snapshotData)
    }
  }, [reset, snapshotData])

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

  return (
    <BCTypography variant="body4" color="text">
      {!isEditing && (
        <ul>
          {formFields(t).map(({ name, label }) => (
            <li key={name}>
              <strong>{label}:</strong>{' '}
              {snapshotData[name] || (
                <BCTypography variant="body4" color="error">
                  Required
                </BCTypography>
              )}
            </li>
          ))}
        </ul>
      )}
      {isEditing && (
        <form onSubmit={handleSubmit(onSubmit, onError)}>
          <FormProvider {...{ control, setValue }}>
            <Stack spacing={1} mb={3}>
              {formFields(t).map((field) => (
                <BCFormText
                  data-test={field.name}
                  key={field.name}
                  control={control}
                  label={field.label}
                  name={field.name}
                  optional={field.optional}
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
