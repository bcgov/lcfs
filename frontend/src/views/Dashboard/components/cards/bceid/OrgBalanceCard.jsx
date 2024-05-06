import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Tooltip, Fade } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import BCTypography from '@/components/BCTypography';
import Loading from '@/components/Loading';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCurrentOrgBalance } from '@/hooks/useOrganization';

export const OrgBalanceCard = () => {
  const { t } = useTranslation(['org']);
  const { data: currentUser, isLoading: isUserLoading, isError: isUserError } = useCurrentUser();
  const { data: orgBalance, isLoading: isBalanceLoading, isError: isBalanceError } = useCurrentOrgBalance();

  const Content = () => {
    if (isUserLoading || isBalanceLoading) {
      return <Loading message={t('org:loadingBalanceDetails')} />;
    } else if (isUserError || isBalanceError || !orgBalance) {
      return (
        <BCTypography color="error" variant="body1" style={{ padding: '16px' }}>
          {t('org:unableToFetchBalanceDetails')}
        </BCTypography>
      );
    } else {
      return (
        <>
          <BCTypography style={{ fontSize: '18px', color: '#003366', marginBottom: '-2px' }} gutterBottom>
            <strong>{currentUser?.organization?.name || t('org:org')}</strong>
          </BCTypography>
          <BCTypography style={{ fontSize: '16px', color: '#003366', marginBottom: '-4px' }}>
            {t('org:hasABalanceOf')}
          </BCTypography>
          <BCTypography style={{ fontSize: '32px', color: '#578260', marginBottom: '-4px' }} component="span">
            {orgBalance.totalBalance.toLocaleString()}
          </BCTypography>
          <BCTypography style={{ fontSize: '18px', color: '#003366', marginBottom: '-5px' }}>
            <strong>{t('org:complianceUnits')}</strong>
          </BCTypography>
          <Box display="flex" alignItems="center" mt={1}>
            <BCTypography style={{ fontSize: '22px', color: '#578260' }} component="span">
              ({orgBalance.reservedBalance.toLocaleString()} {t('org:inReserve')})
            </BCTypography>
            <Tooltip
                title={t('org:inReserveTooltip')}
                TransitionComponent={Fade}
                arrow
              >
              <InfoIcon style={{ marginLeft: '4px', color: '#578260' }} />
            </Tooltip>
          </Box>
        </>
      );
    }
  };

  return (
    <Box p={2} paddingTop={4} paddingBottom={4} bgcolor="background.grey" display="flex" flexDirection="column" alignItems="center" justifyContent="center">
      <Content />
    </Box>
  );
};
