import BCBadge from '@/components/BCBadge'
import BCBox from '@/components/BCBox'

export const StatusRenderer = (props) => {
  const cellValue = props.valueFormatted ? props.valueFormatted : props.value

  return cellValue === 'true' ? (
    <BCBox ml={2}>
      <BCBadge
        badgeContent="active"
        color="success"
        variant="gradient"
        size="sm"
      />
    </BCBox>
  ) : (
    <BCBox ml={1.5}>
      <BCBadge
        badgeContent="inactive"
        color="dark"
        variant="gradient"
        size="sm"
      />
    </BCBox>
  )
}
