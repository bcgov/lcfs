import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import AdjacentItemNavigation from '@/components/AdjacentItemNavigation'
import { ROUTES, buildPath } from '@/routes/routes'

export const DesignatedActionNavigation = ({
  siblingActionIds = [],
  designatedActionId,
  initiativeAgreementId,
  actionNumber,
  actionLabel,
  previousTestId = 'previous-action-button',
  nextTestId = 'next-action-button',
  currentTestId = 'designated-action-label'
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
    <AdjacentItemNavigation
      currentLabel={label}
      currentLabelSx={{ color: 'primary.main', fontWeight: 700 }}
      previousAriaLabel={t('initiativeAgreement:actionDetail.previousAction')}
      nextAriaLabel={t('initiativeAgreement:actionDetail.nextAction')}
      previousDisabled={!previousId}
      nextDisabled={!nextId}
      onPrevious={() => goToSibling(previousId)}
      onNext={() => goToSibling(nextId)}
      previousTestId={previousTestId}
      nextTestId={nextTestId}
      currentTestId={currentTestId}
      testIdPrefix="designated-action-navigation"
    />
  )
}

export default DesignatedActionNavigation
