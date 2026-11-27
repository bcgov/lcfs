import { useTranslation } from 'react-i18next'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'

// Says why the edit controls are gone while an agreement's package is
// read-only (#5554). Whether it is comes from the API (packageEditable),
// so the page and the server cannot disagree. A plain Alert, not BCAlert:
// that one clamps to a line and fades info notices out, and this one has
// to stay readable for as long as the package is locked.
//
// `action` is where the change order starts. #5555 passes its "Start
// change order" button here; until then nothing is passed and the notice
// stands alone.
export const PackageLockNotice = ({ status, action = null }) => {
  const { t } = useTranslation(['initiativeAgreement'])
  return (
    <Alert
      severity="info"
      data-test="package-lock-notice"
      sx={{ mb: 3 }}
      action={
        action ? (
          <span data-test="package-lock-notice-action">{action}</span>
        ) : undefined
      }
    >
      <AlertTitle>
        {t('initiativeAgreement:detail.packageLockedTitle', { status })}
      </AlertTitle>
      {t('initiativeAgreement:detail.packageLockedBody')}
    </Alert>
  )
}
