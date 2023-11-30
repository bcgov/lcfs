import React from 'react';
import { Outlet } from 'react-router-dom';
import RequireAuth from 'components/RequireAuth';
import * as appRoutes from 'constants/routes';

const PublicLayout = () => {
  return (
    <RequireAuth redirectTo={appRoutes.LOGIN}>
      <main>
        <Outlet />
      </main>
    </RequireAuth>
  );
};

export default PublicLayout;
