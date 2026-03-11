import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AdminLayout from './components/layout/AdminLayout';
import AdminLogin from './pages/auth/AdminLogin';
import Dashboard from './pages/Dashboard';
import Users from './pages/users/Users';
import UserDetail from './pages/users/UserDetail';
import Portfolios from './pages/portfolios/Portfolios';
import Categories from './pages/dropdowns/Categories';
import Types from './pages/dropdowns/Types';

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="users/:id" element={<UserDetail />} />
            <Route path="portfolios" element={<Portfolios />} />
            <Route path="categories" element={<Categories />} />
            <Route path="types" element={<Types />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
