import BCBadge from '@/components/BCBadge'
import Stack from '@mui/material/Stack'
import BCTypography from '@/components/BCTypography'
import { Role } from '@/components/Role'
import { roles } from '@/constants/roles'
import { useOrganizationBalance } from '@/hooks/useOrganization'

interface OrganizationBadgeProps {
  organizationId: number | string
  organizationName: string
  transferStatus: string
  isGovernmentUser: boolean
}

interface OrganizationBalance {
  totalBalance: number
  reservedBalance: number
  registered: boolean
}

export const OrganizationBadge = ({
  organizationId,
  organizationName,
  transferStatus,
  isGovernmentUser
}: OrganizationBadgeProps) => {
  const { data: orgInfo } = useOrganizationBalance<OrganizationBalance>(
    organizationId,
    { enabled: isGovernmentUser }
  )

  return (
    <BCBadge
      badgeContent={
        <>
          <Stack direction="column">
            <BCTypography variant="body4">{organizationName}</BCTypography>
            {['Submitted', 'Recommended'].includes(transferStatus) && (
              <Role roles={[roles.government]}>
                <BCTypography variant="body4">
                  Balance: {orgInfo?.totalBalance.toLocaleString()} (
                  {Math.abs(
                    orgInfo?.reservedBalance ?? Number.NaN
                  ).toLocaleString()}
                  )
                </BCTypography>
                <BCTypography variant="body4">
                  Registered: {orgInfo?.registered ? 'Yes' : 'No'}
                </BCTypography>
              </Role>
            )}
          </Stack>
        </>
      }
      color={'primary'}
      variant="outlined"
      size="md"
      sx={({ palette: { primary } }) => ({
        minHeight: '90px',
        padding: '4px',
        display: 'flex',
        justifyContent: 'center',
        '& .MuiBadge-badge': {
          border: `4px solid ${primary.main}`,
          borderRadius: '20px',
          minWidth: '300px',
          textTransform: 'capitalize',
          fontWeight: '100',
          fontSize: '1rem'
        }
      })}
    />
  )
}
