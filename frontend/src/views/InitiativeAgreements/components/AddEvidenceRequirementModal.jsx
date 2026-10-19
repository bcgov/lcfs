import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'

import BCModal from '@/components/BCModal'
import ModalField from './ModalField'
import { evidencePlainText } from './evidenceRichText'
import { EvidenceRichTextField } from './EvidenceRichTextField'

export const AddEvidenceRequirementModal = ({
  designatedActionId,
  open,
  onClose,
  onCreate,
  isPending
}) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const close = () => {
    setTitle('')
    setDescription('')
    onClose()
  }
  const canCreate =
    title.trim().length > 0 &&
    !!evidencePlainText(description) &&
    !isUploading
  const submit = () => {
    if (!canCreate || isUploading) return
    onCreate({ title: title.trim(), description: description.trim() })
    close()
  }

  return (
    <BCModal
      open={open}
      onClose={close}
      data={{
        title: t('initiativeAgreement:evidence.addTitle'),
        primaryButtonText: t('initiativeAgreement:evidence.createRequirement'),
        primaryButtonAction: submit,
        primaryButtonDisabled: !canCreate || isPending,
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
            <ModalField
              id="eoc-new-title"
              label={t('initiativeAgreement:evidence.titleLabel')}
              value={title}
              autoFocus
              inputProps={{ 'data-test': 'eoc-new-title' }}
              onChange={(event) => setTitle(event.target.value)}
            />
            <EvidenceRichTextField
              designatedActionId={designatedActionId}
              label={t('initiativeAgreement:evidence.descriptionLabel')}
              testId="eoc-new-description"
              canEdit
              inline
              locked={false}
              onUploadingChange={setIsUploading}
              field={{
                value: description,
                onChange: (event) => setDescription(event.target.value)
              }}
            />
          </Box>
        )
      }}
    />
  )
}
