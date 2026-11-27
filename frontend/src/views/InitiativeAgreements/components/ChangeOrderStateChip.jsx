import { useTranslation } from 'react-i18next'
import Tooltip from '@mui/material/Tooltip'

import BCBox from '@/components/BCBox'

const COLOURS = {
  added: { bgcolor: 'info.main', color: 'info.contrastText' },
  edited: { bgcolor: 'warning.main', color: 'warning.contrastText' },
  removed: { bgcolor: 'error.main', color: 'error.contrastText' }
}

/**
 * How a record stands in the open change order (#5555): added, edited or
 * to be removed. Renders nothing outside a change order.
 */
export const ChangeOrderStateChip = ({ state, sx, ...props }) => {
  const { t } = useTranslation(['initiativeAgreement'])
  if (!state || !COLOURS[state]) return null
  return (
    <Tooltip title={t(`initiativeAgreement:changeOrder.stateHint.${state}`)}>
      <BCBox
        component="span"
        data-test="change-order-state"
        data-state={state}
        sx={{
          display: 'inline-block',
          px: 1,
          py: 0.1,
          borderRadius: 4,
          fontSize: '0.75rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          ...COLOURS[state],
          ...sx
        }}
        {...props}
      >
        {t(`initiativeAgreement:changeOrder.state.${state}`)}
      </BCBox>
    </Tooltip>
  )
}

export default ChangeOrderStateChip
