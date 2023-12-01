import BCBadge from '@/components/BCBadge'
import BCBox from '@/components/BCBox'

const StatusRenderer = (props) => {
  const cellValue = props.valueFormatted ? props.valueFormatted : props.value

  return (
    cellValue === 'Active'
      ? (
        <BCBox ml={2}>
          <BCBadge badgeContent="active" color="success" variant="gradient" size="sm" />
        </BCBox>)
      : (
        <BCBox ml={1.5}>
          <BCBadge badgeContent="inactive" color="dark" variant="gradient" size="sm" />
        </BCBox>
        )
  )
}

export default StatusRenderer
