import Checkbox from '@mui/material/Checkbox'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormGroup from '@mui/material/FormGroup'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import type { InputHTMLAttributes } from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import BCButton from '@/components/BCButton'
import BCTypography from '@/components/BCTypography'
import type { LCJFIPFormValues } from '../lcjfipForm'
import { underlinedLink } from './underlinedLink'

const DECLARATIONS = [
  { name: 'authority', textKey: 'declarationAuthority' },
  { name: 'documentation', textKey: 'declarationDocumentation' },
  { name: 'publicRecognition', textKey: 'declarationPublicRecognition' }
] as const

export const SigningSection = ({
  readOnly,
  canDelete,
  busy,
  submittedLine,
  onSubmit,
  onDelete
}: {
  readOnly: boolean
  canDelete: boolean
  busy: boolean
  submittedLine?: string | null
  onSubmit: () => void
  onDelete: () => void
}) => {
  const { t } = useTranslation(['lcjfip'])
  const {
    control,
    formState: { errors }
  } = useFormContext<LCJFIPFormValues>()
  const declarations = useWatch({ control, name: 'declarations' })
  const allDeclared =
    declarations.authority &&
    declarations.documentation &&
    declarations.publicRecognition
  const programEmail = t('lcjfip:programEmail')
  const declarationsError = (errors.declarations as { message?: string })
    ?.message

  return (
    <section aria-labelledby="lcjfip-signing-heading">
      <BCTypography
        id="lcjfip-signing-heading"
        variant="h6"
        component="h3"
        color="primary"
        mb={2}
      >
        {t('lcjfip:signing.heading')}
      </BCTypography>
      <BCTypography variant="body2" mb={3}>
        {t('lcjfip:signing.collectionNotice')}{' '}
        <Link sx={underlinedLink} href={`mailto:${programEmail}`}>
          {programEmail}
        </Link>
      </BCTypography>

      {submittedLine ? (
        <BCTypography
          variant="body2"
          sx={{ fontWeight: 600 }}
          data-test="lcjfip-submitted-line"
        >
          {submittedLine}
        </BCTypography>
      ) : (
        <>
          <FormControl
            component="fieldset"
            error={!!declarationsError}
            sx={{ mb: 3 }}
          >
            <FormLabel component="legend" sx={visuallyHidden}>
              {t('lcjfip:signing.declarationsLabel')}
            </FormLabel>
            <FormGroup>
              {DECLARATIONS.map((declaration) => (
                <Controller
                  key={declaration.name}
                  name={`declarations.${declaration.name}`}
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      sx={{ alignItems: 'flex-start', mb: 1.5 }}
                      control={
                        <Checkbox
                          checked={!!field.value}
                          onChange={(event) =>
                            field.onChange(event.target.checked)
                          }
                          inputRef={field.ref}
                          disabled={readOnly}
                          size="small"
                          sx={{ pt: 0.25 }}
                          inputProps={
                            {
                              'data-test': `lcjfip-declaration-${declaration.name}`
                            } as InputHTMLAttributes<HTMLInputElement>
                          }
                        />
                      }
                      label={
                        <BCTypography variant="body2">
                          {t(`lcjfip:signing.${declaration.textKey}`)}
                        </BCTypography>
                      }
                    />
                  )}
                />
              ))}
            </FormGroup>
            {declarationsError && (
              <FormHelperText>{declarationsError}</FormHelperText>
            )}
          </FormControl>

          {!readOnly && (
            <>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <BCButton
                  variant="contained"
                  color="primary"
                  onClick={onSubmit}
                  disabled={!allDeclared || busy}
                  aria-describedby={
                    allDeclared ? undefined : 'lcjfip-submit-hint'
                  }
                  data-test="lcjfip-submit"
                >
                  {t('lcjfip:actions.submit')}
                </BCButton>
                {canDelete && (
                  <BCButton
                    variant="outlined"
                    color="error"
                    onClick={onDelete}
                    disabled={busy}
                    data-test="lcjfip-delete"
                  >
                    {t('lcjfip:actions.delete')}
                  </BCButton>
                )}
              </Stack>
              {!allDeclared && (
                <BCTypography
                  id="lcjfip-submit-hint"
                  variant="body2"
                  color="text.secondary"
                  mt={1}
                >
                  {t('lcjfip:signing.submitHint')}
                </BCTypography>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}

const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px'
} as const
