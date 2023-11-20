import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import * as appRoutes from './constants/routes'
import RequireAuth from './components/RequireAuth';
import Login from './components/Login'
import NotFound from './components/NotFound'
// import Dashboard from './views/dashboard'
// import Layout from './components/Layout'
import UsersTable from './components/Organizations/UsersTable';
import DefaultNavbar from 'components/Navbars/DefaultNavbar';

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route
        path="/"
        exact
        element={
          <RequireAuth redirectTo={appRoutes.LOGIN}>
            {/* <Layout>
              <Dashboard />
            </Layout> */}
            {/* Place the below Navbar later inside the Page Layout */}
            <DefaultNavbar />
          </RequireAuth>
        }
      />
      <Route path={appRoutes.LOGIN} element={<Login />} />
      <Route element={<NotFound />} />
      <Route path={appRoutes.ORGANIZATIONS} element={<UsersTable />} />
    </Routes>
  </BrowserRouter>
)

export default App
