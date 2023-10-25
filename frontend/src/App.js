import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import * as appRoutes from './constants/routes'
import Login from './components/Login';
import NotFound from './components/NotFound'
import Dashboard from './views/dashboard'
import { useKeycloak } from '@react-keycloak/web';
import Layout from './components/Layout';

const RequireAuth = ({ children, redirectTo }) => {
  const { keycloak } = useKeycloak();
  return keycloak.authenticated ? children : <Navigate to={redirectTo} />;
};

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route
        path="/"
        exact
        element={
          <RequireAuth redirectTo={appRoutes.LOGIN}>
            <Layout>
              <Dashboard />
            </Layout>
          </RequireAuth>
        }
      />
      <Route path={appRoutes.LOGIN} element={<Login />} />
      <Route element={<NotFound/>} />
    </Routes>
  </BrowserRouter>
);

export default App;
