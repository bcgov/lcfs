import { Card, CardContent, Grid, Stack } from '@mui/material'
import { BCResponsiveEChart } from './BCResponsiveEchart'
import BCTypography from '../BCTypography'
import { useTheme } from '@mui/material/styles'
import { faSackDollar } from '@fortawesome/free-solid-svg-icons'

export const BCMetricCard = ({
  title,
  value,
  subtitle = undefined,
  option = undefined,
  ariaLabel = undefined,
  icon = undefined
}) => {
  const theme = useTheme()
  const accentColor = theme.palette.primary.main
  const resolvedIcon = icon || faSackDollar

  return (
    <Card
      tabIndex={0}
      role="region"
      aria-label={ariaLabel || title}
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 16px 40px rgba(15, 23, 42, 0.1)',
        border: '0.5px solid rgba(15, 23, 42, 0.4)',
        '&:focus': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: '2px'
        }
      }}
    >
      {/* <Box
        sx={{
          position: 'absolute',
          bottom: -104,
          right: -140,
          width: 210,
          height: 244,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(theme.palette.secondary.main, 0.5)} 0%, transparent 90%)`,
          pointerEvents: 'none'
        }}
        aria-hidden
      /> */}
      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
        <Grid container spacing={1}>
          <Grid item xs={12} sm={option ? 5 : 12}>
            <Stack direction="row" spacing={2} alignItems="center">
              {/* <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(135deg, ${alpha(accentColor, 0.18)} 0%, ${alpha(accentColor, 0.32)} 100%)`,
                  color: theme.palette.primary.main,
                  flexShrink: 0
                }}
                aria-hidden
              >
                <FontAwesomeIcon icon={resolvedIcon} size="lg" />
              </Box> */}
              <Stack spacing={0.5}>
                <BCTypography variant="h5" fontWeight="bold" color="primary">
                  {value}
                </BCTypography>
                <BCTypography variant="subtitle2" color="text.secondary">
                  {title}
                </BCTypography>
                {subtitle && (
                  <BCTypography variant="caption" color="text.secondary">
                    {subtitle}
                  </BCTypography>
                )}
              </Stack>
            </Stack>
          </Grid>
          <Grid item xs={12} sm={7}>
            {option && (
              <BCResponsiveEChart
                option={option}
                height={72}
                ariaLabel={ariaLabel}
                tabIndex={-1}
              />
            )}
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}
