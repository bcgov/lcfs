import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import BCBox from '@/components/BCBox'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import { ROUTES, buildPath } from '@/routes/routes'

const navButtonSx = {
  backgroundColor: '#003366',
  color: 'white !important',
  borderRadius: '50%',
  width: 25,
  height: 25,
  padding: 0,
  '& .MuiSvgIcon-root': {
    color: 'white',
    fontSize: '18px !important'
  },
  '&:hover': {
    backgroundColor: '#004080',
    '& .MuiSvgIcon-root': { color: 'white' }
  },
  '&.Mui-disabled': {
    backgroundColor: '#c0c0c0',
    color: '#808080'
  }
}

export const DesignatedActionNavigation = ({
  siblingActionIds = [],
  designatedActionId,
  initiativeAgreementId,
  actionNumber,
  actionLabel,
  previousTestId = 'previous-action-button',
  nextTestId = 'next-action-button'
}) => {
  const { t } = useTranslation(['initiativeAgreement'])
  const navigate = useNavigate()
  const currentIndex = siblingActionIds.findIndex(
    (id) => Number(id) === Number(designatedActionId)
  )
  const previousId = currentIndex > 0 ? siblingActionIds[currentIndex - 1] : null
  const nextId =
    currentIndex >= 0 && currentIndex < siblingActionIds.length - 1
      ? siblingActionIds[currentIndex + 1]
      : null
  const label =
    actionLabel || `DA${actionNumber}-IA${initiativeAgreementId}`

  const goToSibling = (siblingId) => {
    if (!siblingId) return
    navigate(
      buildPath(ROUTES.INITIATIVE_AGREEMENTS.ACTION_VIEW, {
        initiativeAgreementId,
        designatedActionId: siblingId
      })
    )
  }

  return (
    <BCBox
      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      data-test="designated-action-navigation"
    >
      <BCButton
        variant="contained"
        color="primary"
        iconOnly
        size="small"
        data-test={previousTestId}
        aria-label={t('initiativeAgreement:actionDetail.previousAction')}
        disabled={!previousId}
        onClick={() => goToSibling(previousId)}
        sx={navButtonSx}
      >
        <ChevronLeftIcon />
      </BCButton>
      <BCTypography
        variant="body4"
        sx={{ color: 'primary.main', fontWeight: 700 }}
      >
        {label}
      </BCTypography>
      <BCButton
        variant="contained"
        color="primary"
        iconOnly
        size="small"
        data-test={nextTestId}
        aria-label={t('initiativeAgreement:actionDetail.nextAction')}
        disabled={!nextId}
        onClick={() => goToSibling(nextId)}
        sx={navButtonSx}
      >
        <ChevronRightIcon />
      </BCButton>
    </BCBox>
  )
}

export default DesignatedActionNavigation
