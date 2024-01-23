import BCBadge from '@/components/BCBadge'

export const OrganizationBadge = ({ content }) => (
  <BCBadge
    badgeContent={content}
    color={'primary'}
    variant="outlined"
    size="md"
    sx={({ palette: { primary } }) => ({
      height: '90px',
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
