import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Login from '../components/Login';
import NotFound from '../components/NotFound'
import Dashboard from '../dashboard'
import { useKeycloak } from '@react-keycloak/web';
import Layout from '../components/Layout';

const RequireAuth = ({ children, redirectTo }) => {
  const { keycloak } = useKeycloak();
  return keycloak.authenticated ? children : <Navigate to={redirectTo} />;
};

const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route
        path="/"
        exact
        element={
          <RequireAuth redirectTo="/login">
            <Layout>
              <Dashboard />
            </Layout>
          </RequireAuth>
        }
      />
      <Route path="/login" element={<Login />} />
      <Route element={<NotFound/>} />
    </Routes>
  </BrowserRouter>
);

export default AppRouter;
