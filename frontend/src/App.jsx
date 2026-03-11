import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import DashboardLayout from './components/layout/DashboardLayout';
import Landing from './pages/public/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Overview from './pages/dashboard/Overview';
import Portfolio from './pages/dashboard/Portfolio';
import Upload from './pages/dashboard/Upload';
import Profile from './pages/dashboard/Profile';
import PublicProfile from './pages/public/PublicProfile';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Overview />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="upload" element={<Upload />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          <Route path="/:username" element={<PublicProfile />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
