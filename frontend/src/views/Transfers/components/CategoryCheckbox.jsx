import BCTypography from '@/components/BCTypography'
import { useTransfer, useUpdateCategory } from '@/hooks/useTransfer'
import { useLoadingStore } from '@/stores/useLoadingStore'
import { Checkbox, FormControlLabel } from '@mui/material'
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

export const CategoryCheckbox = () => {
  const { transferId } = useParams()
  const setLoading = useLoadingStore((state) => state.setLoading)

  const { data: transferData, isFetching } = useTransfer({ transferId })

  const { mutate: updateCategory, isPending } = useUpdateCategory({
    transferId
  })

  useEffect(() => {
    if (!isFetching) {
      setLoading(false)
    }
    if (isPending) {
      setLoading(true)
    }
  }, [isFetching, isPending, setLoading])

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
