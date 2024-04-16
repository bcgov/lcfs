import BCTypography from '@/components/BCTypography'
import { useTransfer, useUpdateCategory } from '@/hooks/useTransfer'
import { useLoadingStore } from '@/stores/useLoadingStore'
import { Checkbox, FormControlLabel } from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

export const CategoryCheckbox = () => {
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
          />
        }
        label={
          <BCTypography variant="body2">
            Select the checkbox to set the transfer as{' '}
            <strong>Category D</strong> if the price is significantly less than
            fair market value. This will override the default category
            determined by the agreement and approval dates indicated above.
          </BCTypography>
        }
      />
    </div>
  )
}
