import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import AddIcon from '@mui/icons-material/Add'

import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import Loading from '@/components/Loading'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import {
  useCreateEvidenceRequirement,
  useDeleteEvidenceRequirement,
  useEvidenceRequirements,
  useUpdateEvidenceRequirement
} from '@/hooks/useInitiativeAgreements'
import { evidencePlainText } from './evidenceRichText'
import { EvidenceRequirementCard } from './EvidenceRequirementCard'
import { OUTCOME_INFORMATION_REQUESTED } from './evidenceConstants'
import { AddEvidenceRequirementModal } from './AddEvidenceRequirementModal'

export const EvidenceOfCompletion = ({
  designatedActionId,
  canEdit = true,
  actions = null,
  renderRequestAction = null,
  missingInformationReadOnly = false
}) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [expandedIds, setExpandedIds] = useState([])
  const [adding, setAdding] = useState(false)

  const { data: requirements = [], isLoading } =
    useEvidenceRequirements(designatedActionId)
  const { mutate: createRequirement, isPending: isCreating } =
    useCreateEvidenceRequirement(designatedActionId)
  const { mutate: updateRequirement } =
    useUpdateEvidenceRequirement(designatedActionId)
  const { mutate: removeRequirement } =
    useDeleteEvidenceRequirement(designatedActionId)
  const requestedRequirements = requirements.filter(
    (requirement) => requirement.reviewOutcome === OUTCOME_INFORMATION_REQUESTED
  )
  const allRequestsComplete =
    requestedRequirements.length > 0 &&
    requestedRequirements.every((requirement) =>
      evidencePlainText(requirement.missingInformation)
    )

  const setRequirementExpanded = (id, expanded) => {
    setExpandedIds((previous) =>
      expanded
        ? previous.includes(id)
          ? previous
          : [...previous, id]
        : previous.filter((expandedId) => expandedId !== id)
    )
  }

  return (
    <Box sx={{ mt: 3 }} data-test="evidence-of-completion-section">
      <Box
        data-test="eoc-header"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          minHeight: 48,
          mb: 2
        }}
      >
        <BCTypography variant="h6" color="primary" component="div">
          {t('initiativeAgreement:evidence.sectionTitle')}
          <Link
            component="button"
            type="button"
            variant="body2"
            data-test="eoc-expand-all"
            onClick={() =>
              setExpandedIds(
                requirements.map(
                  (requirement) => requirement.evidenceRequirementId
                )
              )
            }
            sx={{ ml: 2, mr: 1, textDecoration: 'underline' }}
          >
            {t('report:expandAll')}
          </Link>
          |
          <Link
            component="button"
            type="button"
            variant="body2"
            data-test="eoc-collapse-all"
            onClick={() => setExpandedIds([])}
            sx={{ ml: 1, textDecoration: 'underline' }}
          >
            {t('report:collapseAll')}
          </Link>
        </BCTypography>
        <Role roles={[roles.ia_analyst, roles.ia_manager]}>
          <BCButton
            type="button"
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<AddIcon sx={{ width: '1rem', height: '1rem' }} />}
            data-test="eoc-add-button"
            onClick={() => setAdding(true)}
          >
            {t('initiativeAgreement:evidence.addEoc')}
          </BCButton>
        </Role>
      </Box>

      {isLoading ? (
        <Loading message={t('initiativeAgreement:evidence.loading')} />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {requirements.map((requirement) => (
            <EvidenceRequirementCard
              designatedActionId={designatedActionId}
              key={requirement.evidenceRequirementId}
              requirement={requirement}
              expanded={expandedIds.includes(requirement.evidenceRequirementId)}
              setExpanded={(expanded) =>
                setRequirementExpanded(
                  requirement.evidenceRequirementId,
                  expanded
                )
              }
              canEdit={canEdit}
              missingInformationReadOnly={missingInformationReadOnly}
              actions={renderRequestAction?.(requirement, allRequestsComplete)}
              allRequestsComplete={allRequestsComplete}
              onSave={(payload, callbacks) =>
                updateRequirement(
                  {
                    evidenceRequirementId: requirement.evidenceRequirementId,
                    ...payload
                  },
                  callbacks
                )
              }
              onRemove={() =>
                removeRequirement(requirement.evidenceRequirementId)
              }
            />
          ))}

          {!requirements.length && (
            <BCTypography variant="body4" color="text.secondary">
              {t('initiativeAgreement:evidence.empty')}
            </BCTypography>
          )}

          {actions && <Box data-test="eoc-review-actions">{actions}</Box>}
        </Box>
      )}

      <AddEvidenceRequirementModal
        designatedActionId={designatedActionId}
        open={adding}
        isPending={isCreating}
        onClose={() => setAdding(false)}
        onCreate={createRequirement}
      />
    </Box>
  )
}

export default EvidenceOfCompletion
