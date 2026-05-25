import BCTypography from '@/components/BCTypography'
import BCModal from '@/components/BCModal'
import { useTransfer, useUpdateCategory } from '@/hooks/useTransfer'
import { useLoadingStore } from '@/stores/useLoadingStore'
import {
  Box,
  Checkbox,
  FormControlLabel,
  Radio,
  RadioGroup
} from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export const CategoryCheckbox = ({ isDisabled = false }) => {
  const { t } = useTranslation(['transfer', 'common'])
  const { transferId } = useParams()
  const queryClient = useQueryClient()
  const setLoading = useLoadingStore((state) => state.setLoading)
  const [pendingUpdate, setPendingUpdate] = useState(null)

  const { data: transferData, isFetching } = useTransfer(transferId)

  const { mutate: updateCategory } = useUpdateCategory(transferId, {
    onMutate: () => {
      setLoading(true)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['transfer'])
      setPendingUpdate(null)
    }
  })

  useEffect(() => {
    if (!isFetching) {
      setLoading(false)
    }
  }, [isFetching, setLoading])

  const currentCategory = transferData?.transferCategory?.category || ''
  const isA1Category = !!transferData?.isA1Category
  const categoryOptions = [
    { value: 'A', label: 'Category A ( < 6 months)' },
    { value: 'B', label: 'Category B (6 - 12 months)' },
    { value: 'C', label: 'Category C ( > 1 year)' },
    { value: 'D', label: 'Category D (below market value)' }
  ]

  const requestUpdate = (category, nextIsA1Category = isA1Category) => {
    setPendingUpdate({
      category,
      isA1Category: category === 'A' ? nextIsA1Category : false
    })
  }

  return (
    <div data-test="category-checkbox">
      <BCModal
        open={!!pendingUpdate}
        onClose={() => setPendingUpdate(null)}
        data={
          pendingUpdate && {
            title: t('categoryOverrideConfirmTitle'),
            content: (
              <BCTypography variant="body2">
                {t('categoryOverrideConfirmText', {
                  category: pendingUpdate.category,
                  isA1Category: pendingUpdate.isA1Category ? 'Yes' : 'No'
                })}
              </BCTypography>
            ),
            primaryButtonText: t('common:yes'),
            primaryButtonAction: () => updateCategory(pendingUpdate),
            secondaryButtonText: t('common:cancelBtn')
          }
        }
      />
      <Box mt={2}>
        <BCTypography
          variant="body4"
          color="primary"
          sx={{ display: 'block', fontWeight: 700, mb: 1 }}
        >
          {t('categoryOverrideLabel')}
        </BCTypography>
        <RadioGroup
          row
          value={currentCategory}
          onChange={(event) => requestUpdate(event.target.value)}
          sx={{ gap: { xs: 0.5, md: 2 }, alignItems: 'center' }}
        >
          <FormControlLabel
            control={
              <Checkbox
                data-test="checkbox"
                checked={isA1Category}
                onChange={(event) => requestUpdate('A', event.target.checked)}
                disabled={isDisabled}
              />
            }
            label={
              <BCTypography variant="body2">
                {t('categoryA1Label')}
              </BCTypography>
            }
          />
          {categoryOptions.map((category) => (
            <FormControlLabel
              key={category.value}
              value={category.value}
              control={
                <Radio
                  data-test={`category-radio-${category.value}`}
                  disabled={isDisabled}
                />
              }
              label={
                <BCTypography variant="body2">{category.label}</BCTypography>
              }
            />
          ))}
        </RadioGroup>
      </Box>
    </div>
  )
}
