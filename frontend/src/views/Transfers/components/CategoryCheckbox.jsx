import BCTypography from '@/components/BCTypography'
import { useTransfer, useUpdateCategory } from '@/hooks/useTransfer'
import { useLoadingStore } from '@/stores/useLoadingStore'
import { Checkbox, FormControlLabel } from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export const CategoryCheckbox = ({ isDisabled = false }) => {
  const { t } = useTranslation(['transfer'])
  const { transferId } = useParams()
  const queryClient = useQueryClient()
  const setLoading = useLoadingStore((state) => state.setLoading)

  const { data: transferData, isFetching } = useTransfer(transferId)

  const { mutate: updateCategory } = useUpdateCategory(transferId, {
    onMutate: () => {
      setLoading(true)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['transfer'])
    }
  })

  useEffect(() => {
    if (!isFetching) {
      setLoading(false)
    }
  }, [isFetching, setLoading])

  return (
    <div data-test="category-checkbox">
      <FormControlLabel
        control={
          <Checkbox
            data-test="checkbox"
            checked={transferData?.transferCategory?.category === 'D'}
            onClick={(e) => updateCategory(e.target.checked ? 'D' : null)}
            disabled={isDisabled}
          />
        }
        label={
          <BCTypography
            variant="body2"
            dangerouslySetInnerHTML={{ __html: t('categoryCheckbox') }}
          />
        }
      />
    </div>
  )
}
