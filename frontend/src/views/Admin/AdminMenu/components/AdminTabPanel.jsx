import PropTypes from 'prop-types'
import BCBox from '@/components/BCBox'

export function AdminTabPanel(props) {
  const { children, value, index, ...other } = props

  return (
    <BCBox
      component="div"
      role="AdminTabPanel"
      hidden={value !== index}
      id={`full-width-AdminTabPanel-${index}`}
      aria-labelledby={`full-width-tab-${index}`}
      {...other}
    >
      {value === index && <BCBox sx={{ p: 3 }}>{children}</BCBox>}
    </BCBox>
  )
}

AdminTabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired
}
