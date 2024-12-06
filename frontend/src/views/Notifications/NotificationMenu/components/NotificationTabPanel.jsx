import PropTypes from 'prop-types'
import BCBox from '@/components/BCBox'

export function NotificationTabPanel(props) {
  const { children, value, index, ...other } = props

  return (
    <BCBox
      component="div"
      role="NotificationTabPanel"
      hidden={value !== index}
      id={`full-width-NotificationTabPanel-${index}`}
      aria-labelledby={`full-width-tab-${index}`}
      {...other}
    >
      {value === index && <BCBox sx={{ p: 3 }}>{children}</BCBox>}
    </BCBox>
  )
}

NotificationTabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired
}
