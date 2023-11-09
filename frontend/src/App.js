import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import * as appRoutes from './constants/routes'
import RequireAuth from './components/RequireAuth';
import Login from './components/Login'
import NotFound from './components/NotFound'
import Dashboard from './views/dashboard'
import Layout from './components/Layout'

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
)

export default App
