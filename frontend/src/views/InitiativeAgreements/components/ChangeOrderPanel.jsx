import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import Box from '@mui/material/Box'

import BCAlert from '@/components/BCAlert'
import BCButton from '@/components/BCButton'
import BCModal from '@/components/BCModal'
import BCTypography from '@/components/BCTypography'
import {
  useAcceptChangeOrder,
  useDiscardChangeOrder,
  useStartChangeOrder
} from '@/hooks/useInitiativeAgreements'
import { timezoneFormatter } from '@/utils/formatters'
import ModalField from './ModalField'

const DATE_FORMAT = 'yyyy-MM-dd'

// The day in the browser's time zone. The API checks the accepted date
// against today in Pacific time, which is where the Director works.
const todayIso = () => format(new Date(), DATE_FORMAT)

const errorDetail = (err, fallback) =>
  err?.response?.data?.detail || err?.message || fallback

/**
 * The agreement's change order controls (#5555): Start on an underway
 * agreement, and while one is drafted, a banner with Accept (Director) and
 * Discard (manager or Director). The server decides which actions the
 * caller has (`changeOrderActions`); this renders only those.
 */
export const ChangeOrderPanel = ({ agreement, onNotify }) => {
  // An organization never gets a change order or any action, so this
  // renders nothing for it.
  if (
    !agreement.changeOrder &&
    !(agreement.changeOrderActions ?? []).includes('start')
  ) {
    return null
  }
  return <ChangeOrderControls agreement={agreement} onNotify={onNotify} />
}

const ChangeOrderControls = ({ agreement, onNotify }) => {
  const { t } = useTranslation(['common', 'initiativeAgreement'])
  const agreementId = agreement.initiativeAgreementId
  const actions = agreement.changeOrderActions ?? []
  const changeOrder = agreement.changeOrder

  const [dialog, setDialog] = useState(null)
  const [acceptedDate, setAcceptedDate] = useState(todayIso)
  const [error, setError] = useState('')
  // BCModal stays busy after its primary action until it closes; a failed
  // action keeps the dialog open, so it is remounted to be usable again.
  const [attempt, setAttempt] = useState(0)
  const fail = (message) => {
    setError(message)
    setAttempt((previous) => previous + 1)
  }

  const { mutate: startChangeOrder, isPending: isStarting } =
    useStartChangeOrder(agreementId)
  const { mutate: acceptChangeOrder, isPending: isAccepting } =
    useAcceptChangeOrder(agreementId)
  const { mutate: discardChangeOrder, isPending: isDiscarding } =
    useDiscardChangeOrder(agreementId)

  const close = () => {
    setDialog(null)
    setError('')
  }
  const open = (name) => {
    setError('')
    if (name === 'accept') setAcceptedDate(todayIso())
    setDialog(name)
  }

  const number = changeOrder?.changeOrderNumber

  const start = () =>
    startChangeOrder(undefined, {
      onSuccess: (profile) => {
        close()
        onNotify?.(
          'success',
          t('initiativeAgreement:changeOrder.started', {
            number: profile?.changeOrder?.changeOrderNumber
          })
        )
      },
      onError: (err) =>
        fail(errorDetail(err, t('initiativeAgreement:changeOrder.startFailed')))
    })

  const accept = () => {
    if (!acceptedDate) {
      fail(t('initiativeAgreement:changeOrder.acceptedDateRequired'))
      return
    }
    if (acceptedDate > todayIso()) {
      fail(t('initiativeAgreement:changeOrder.acceptedDateFuture'))
      return
    }
    acceptChangeOrder(
      { acceptedDate },
      {
        onSuccess: () => {
          close()
          onNotify?.(
            'success',
            t('initiativeAgreement:changeOrder.accepted', { number })
          )
        },
        onError: (err) =>
          fail(
            errorDetail(err, t('initiativeAgreement:changeOrder.acceptFailed'))
          )
      }
    )
  }

  const discard = () =>
    discardChangeOrder(undefined, {
      onSuccess: () => {
        close()
        onNotify?.(
          'success',
          t('initiativeAgreement:changeOrder.discarded', { number })
        )
      },
      onError: (err) =>
        fail(
          errorDetail(err, t('initiativeAgreement:changeOrder.discardFailed'))
        )
    })

  const errorLine = error && (
    <BCTypography variant="body4" color="error" data-test="change-order-error">
      {error}
    </BCTypography>
  )

  return (
    <Box data-test="change-order-panel" sx={{ mb: 3 }}>
      {changeOrder ? (
        <BCAlert
          severity="warning"
          dismissible={false}
          // It describes the agreement's state; it must not fade like a toast.
          noFade
          data-test="change-order-banner"
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap'
            }}
          >
            <Box>
              <BCTypography variant="body4" component="p">
                {t('initiativeAgreement:changeOrder.banner', { number })}
              </BCTypography>
              {changeOrder.startedByDisplayName && (
                <BCTypography variant="body4" component="p">
                  {t('initiativeAgreement:changeOrder.startedBy', {
                    name: changeOrder.startedByDisplayName,
                    date: changeOrder.createDate
                      ? timezoneFormatter({ value: changeOrder.createDate })
                      : ''
                  })}
                </BCTypography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {actions.includes('discard') && (
                <BCButton
                  type="button"
                  variant="outlined"
                  color="error"
                  size="small"
                  data-test="discard-change-order"
                  onClick={() => open('discard')}
                >
                  {t('initiativeAgreement:changeOrder.discard')}
                </BCButton>
              )}
              {actions.includes('accept') && (
                <BCButton
                  type="button"
                  variant="contained"
                  color="primary"
                  size="small"
                  data-test="accept-change-order"
                  onClick={() => open('accept')}
                >
                  {t('initiativeAgreement:changeOrder.accept')}
                </BCButton>
              )}
            </Box>
          </Box>
        </BCAlert>
      ) : (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <BCButton
            type="button"
            variant="outlined"
            color="primary"
            size="small"
            data-test="start-change-order"
            onClick={() => open('start')}
          >
            {t('initiativeAgreement:changeOrder.start')}
          </BCButton>
        </Box>
      )}

      <BCModal
        key={`start-${attempt}`}
        open={dialog === 'start'}
        onClose={close}
        data={{
          title: t('initiativeAgreement:changeOrder.startConfirmTitle'),
          primaryButtonText: t('initiativeAgreement:changeOrder.start'),
          primaryButtonAction: start,
          primaryButtonDisabled: isStarting,
          secondaryButtonText: t('common:cancelBtn'),
          content: (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {errorLine}
              <BCTypography variant="body4" component="p">
                {t('initiativeAgreement:changeOrder.startConfirmBody')}
              </BCTypography>
            </Box>
          )
        }}
      />

      <BCModal
        key={`accept-${attempt}`}
        open={dialog === 'accept'}
        onClose={close}
        data={{
          title: t('initiativeAgreement:changeOrder.acceptTitle', { number }),
          primaryButtonText: t('initiativeAgreement:changeOrder.accept'),
          primaryButtonAction: accept,
          primaryButtonDisabled: isAccepting,
          secondaryButtonText: t('common:cancelBtn'),
          content: (
            <Box
              sx={{
                minWidth: { xs: 'auto', sm: 420 },
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                pt: 1
              }}
            >
              {errorLine}
              <BCTypography variant="body4" component="p">
                {t('initiativeAgreement:changeOrder.acceptBody')}
              </BCTypography>
              <ModalField
                id="change-order-accepted-date"
                label={t('initiativeAgreement:changeOrder.acceptedDateLabel')}
                type="date"
                value={acceptedDate}
                inputProps={{
                  max: todayIso(),
                  'data-test': 'change-order-accepted-date'
                }}
                onChange={(event) => setAcceptedDate(event.target.value)}
              />
              <BCTypography variant="body4" color="text.secondary">
                {t('initiativeAgreement:changeOrder.acceptedDateHint')}
              </BCTypography>
            </Box>
          )
        }}
      />

      <BCModal
        key={`discard-${attempt}`}
        open={dialog === 'discard'}
        onClose={close}
        data={{
          title: t('initiativeAgreement:changeOrder.discardTitle', { number }),
          primaryButtonText: t('initiativeAgreement:changeOrder.discard'),
          primaryButtonColor: 'error',
          primaryButtonAction: discard,
          primaryButtonDisabled: isDiscarding,
          secondaryButtonText: t('common:cancelBtn'),
          content: (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {errorLine}
              <BCTypography variant="body4" component="p">
                {t('initiativeAgreement:changeOrder.discardBody')}
              </BCTypography>
            </Box>
          )
        }}
      />
    </Box>
  )
}

export default ChangeOrderPanel
