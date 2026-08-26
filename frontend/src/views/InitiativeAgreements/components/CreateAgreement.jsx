import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Autocomplete,
  Box,
  InputLabel,
  MenuItem,
  TextField
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'

import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { useOrganizationNames } from '@/hooks/useOrganizations'
import { useCreateAgreement } from '@/hooks/useInitiativeAgreements'
import ModalField from './ModalField'

export const AGREEMENT_TYPES = ['Initiative Agreement', 'P3A']

// Starting an agreement from the index page. Deliberately thin: an analyst
// opening a file has the organization and the agreement code, and little
// else settled. The rest is filled in on the detail page as the agreement
// is negotiated, which is why this lands there on success.
export const CreateAgreement = () => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [organization, setOrganization] = useState(null)
  const [iaCode, setIaCode] = useState('')
  const [agreementType, setAgreementType] = useState(AGREEMENT_TYPES[0])
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')

  const { data: orgNames = [], isLoading: orgsLoading } = useOrganizationNames(
    null,
    { orgFilter: 'all' },
    { enabled: open }
  )

  const options = useMemo(
    () =>
      [...orgNames]
        .map((org) => ({
          id: org.organizationId,
          label: org.name || org.operatingName || `#${org.organizationId}`
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [orgNames]
  )

  const { mutate: createAgreement, isPending } = useCreateAgreement()

  const close = () => {
    setOpen(false)
    setOrganization(null)
    setIaCode('')
    setAgreementType(AGREEMENT_TYPES[0])
    setTitle('')
    setStartDate('')
    setEndDate('')
    setError('')
  }

  const canSubmit = Boolean(organization?.id) && Boolean(iaCode.trim())

  const submit = () => {
    setError('')
    // The modal disables its button without these, but the guard belongs
    // with the action rather than only in the control's appearance.
    if (!canSubmit) return
    createAgreement(
      {
        organizationId: organization.id,
        iaCode: iaCode.trim(),
        agreementType,
        title: title.trim() || null,
        agreementStartDate: startDate || null,
        agreementEndDate: endDate || null
      },
      {
        onSuccess: (created) => {
          close()
          // Straight to the new draft: creation is the start of the work,
          // not the end of it.
          navigate(`${created.initiativeAgreementId}`, {
            state: {
              message: t('initiativeAgreement:create.created', {
                code: created.iaCode
              }),
              severity: 'success'
            }
          })
        },
        onError: (err) =>
          setError(
            err?.response?.data?.detail ||
              err?.message ||
              t('initiativeAgreement:create.failed')
          )
      }
    )
  }

  return (
    <Role roles={[roles.ia_analyst, roles.ia_manager]}>
      <BCButton
        type="button"
        variant="contained"
        color="primary"
        size="small"
        startIcon={<AddIcon />}
        data-test="create-agreement"
        onClick={() => setOpen(true)}
      >
        {t('initiativeAgreement:create.button')}
      </BCButton>

      <BCModal
        open={open}
        onClose={close}
        data={{
          title: t('initiativeAgreement:create.title'),
          primaryButtonText: t('initiativeAgreement:create.confirm'),
          primaryButtonAction: submit,
          primaryButtonDisabled: !canSubmit || isPending,
          secondaryButtonText: t('common:cancelBtn'),
          content: (
            <Box
              sx={{
                minWidth: { xs: 'auto', sm: 460 },
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                pt: 1
              }}
            >
              {error && (
                <BCTypography
                  variant="body4"
                  color="error"
                  data-test="create-agreement-error"
                >
                  {error}
                </BCTypography>
              )}

              <div>
                <InputLabel
                  htmlFor="create-agreement-org"
                  component="label"
                  className="form-label"
                >
                  <BCTypography variant="label" component="span">
                    {t('initiativeAgreement:create.organizationLabel')}
                  </BCTypography>
                </InputLabel>
                <Autocomplete
                  id="create-agreement-org"
                  options={options}
                  loading={orgsLoading}
                  value={organization}
                  isOptionEqualToValue={(option, val) => option.id === val?.id}
                  onChange={(_event, value) => setOrganization(value)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      inputProps={{
                        ...params.inputProps,
                        'data-test': 'create-agreement-org'
                      }}
                    />
                  )}
                />
              </div>

              <ModalField
                id="create-agreement-code"
                label={t('initiativeAgreement:create.codeLabel')}
                value={iaCode}
                inputProps={{ 'data-test': 'create-agreement-code' }}
                onChange={(event) => setIaCode(event.target.value)}
              />

              <div>
                <InputLabel
                  htmlFor="create-agreement-type"
                  component="label"
                  className="form-label"
                >
                  <BCTypography variant="label" component="span">
                    {t('initiativeAgreement:create.typeLabel')}
                  </BCTypography>
                </InputLabel>
                <TextField
                  id="create-agreement-type"
                  select
                  fullWidth
                  size="small"
                  value={agreementType}
                  inputProps={{ 'data-test': 'create-agreement-type' }}
                  onChange={(event) => setAgreementType(event.target.value)}
                >
                  {AGREEMENT_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>
              </div>

              <ModalField
                id="create-agreement-title"
                label={t('initiativeAgreement:create.titleLabel')}
                optional
                value={title}
                inputProps={{ 'data-test': 'create-agreement-title' }}
                onChange={(event) => setTitle(event.target.value)}
              />

              <ModalField
                id="create-agreement-start"
                label={t('initiativeAgreement:create.startLabel')}
                optional
                type="date"
                value={startDate}
                inputProps={{ 'data-test': 'create-agreement-start' }}
                onChange={(event) => setStartDate(event.target.value)}
              />

              <ModalField
                id="create-agreement-end"
                label={t('initiativeAgreement:create.endLabel')}
                optional
                type="date"
                value={endDate}
                inputProps={{ 'data-test': 'create-agreement-end' }}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </Box>
          )
        }}
      />
    </Role>
  )
}

export default CreateAgreement
