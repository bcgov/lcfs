import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox, FormControlLabel, Paper } from '@mui/material'
import BCTypography from '@/components/BCTypography'
import BCAlert from '@/components/BCAlert'
import Box from '@mui/material/Box'

const SigningAuthorityDeclaration = ({
  onChange,
  hasAuthority,
  hasRecords,
  hasValidAddress,
  hasEligibleRenewableFuel
}) => {
  const { t } = useTranslation(['report'])
  const [checked, setChecked] = useState({
    certifyInfo: false,
    certifyClaim: false
  })

  useEffect(() => {
    onChange(checked)
  }, [checked, onChange])

  const renderAlert = (propKey) => {
    return (
      <Box sx={{ mt: '8px' }}>
        <BCAlert
          data-test="alert-box"
          severity="warning"
          noFade={true}
          dismissible={false}
        >
          {t(propKey)}
        </BCAlert>
      </Box>
    )
  }

  return (
    <Paper
      sx={{
        marginTop: 2,
        textAlign: 'left',
        boxShadow: 'none',
        border: 'none'
      }}
      elevation={0}
    >
      <BCTypography color="primary" variant="h6">
        {t('report:signingAuthorityDeclaration')}
      </BCTypography>
      {!hasRecords && renderAlert('report:noRecords')}
      {!hasAuthority && renderAlert('report:noSigningAuthorityTooltip')}
      {!hasValidAddress && renderAlert('report:invalidAddress')}
      {/* {!hasEligibleRenewableFuel && renderAlert('report:invalidAddress')} */}
      {hasEligibleRenewableFuel && (
        <FormControlLabel
          control={
            <Checkbox
              disabled={!hasRecords || !hasAuthority || !hasValidAddress}
              checked={checked.certifyClaim}
              onChange={(event) =>
                setChecked({
                  ...checked,
                  certifyClaim: event.target.checked
                })
              }
              id="claim-declaration"
              data-test="claim-checkbox"
              color="primary"
            />
          }
          label={
            <span
              dangerouslySetInnerHTML={{
                __html: t('report:claimDeclarationText')
              }}
            />
          }
          style={{
            marginTop: 20,
            alignItems: 'flex-start'
          }}
        />
      )}
      <FormControlLabel
        control={
          <Checkbox
            disabled={!hasRecords || !hasAuthority || !hasValidAddress}
            checked={checked.certifyInfo}
            onChange={(event) =>
              setChecked({
                ...checked,
                certifyInfo: event.target.checked
              })
            }
            id="signing-authority-declaration"
            data-test="signing-authority-checkbox"
            color="primary"
          />
        }
        label={t('report:declarationText')}
        style={{
          marginTop: 20,
          alignItems: 'flex-start'
        }}
      />
    </Paper>
  )
}

export default SigningAuthorityDeclaration
