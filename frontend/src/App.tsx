import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import TalentLayout from '@/components/layout/TalentLayout';
import BusinessLayout from '@/components/layout/BusinessLayout';

// Pages
import Landing from '@/pages/Landing';
import Login from '@/pages/auth/Login';
import SignupTalent from '@/pages/auth/SignupTalent';
import SignupBusiness from '@/pages/auth/SignupBusiness';
import ForgotPassword from '@/pages/auth/ForgotPassword';

// Talent pages
import TalentDashboard from '@/pages/talent/TalentDashboard';
import ProfileList from '@/pages/talent/ProfileList';
import ProfileCreate from '@/pages/talent/ProfileCreate';
import ProfileEdit from '@/pages/talent/ProfileEdit';
import TalentSettings from '@/pages/talent/TalentSettings';
import TalentNotifications from '@/pages/talent/TalentNotifications';

// Business pages
import BusinessDashboard from '@/pages/business/BusinessDashboard';
import DiscoverCategories from '@/pages/business/DiscoverCategories';
import DiscoverProfiles from '@/pages/business/DiscoverProfiles';
import ViewProfile from '@/pages/business/ViewProfile';
import Shortlist from '@/pages/business/Shortlist';
import Interests from '@/pages/business/Interests';
import BusinessSettings from '@/pages/business/BusinessSettings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup/talent" element={<SignupTalent />} />
            <Route path="/signup/business" element={<SignupBusiness />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Talent routes */}
            <Route element={<ProtectedRoute requiredRole="talent" />}>
              <Route element={<TalentLayout />}>
                <Route path="/talent/dashboard" element={<TalentDashboard />} />
                <Route path="/talent/profiles" element={<ProfileList />} />
                <Route path="/talent/profiles/new" element={<ProfileCreate />} />
                <Route path="/talent/profiles/:id" element={<ProfileEdit />} />
                <Route path="/talent/profiles/:id/edit" element={<ProfileEdit />} />
                <Route path="/talent/settings" element={<TalentSettings />} />
                <Route path="/talent/notifications" element={<TalentNotifications />} />
              </Route>
            </Route>

            {/* Business routes */}
            <Route element={<ProtectedRoute requiredRole="business" />}>
              <Route element={<BusinessLayout />}>
                <Route path="/business/dashboard" element={<BusinessDashboard />} />
                <Route path="/business/discover" element={<DiscoverCategories />} />
                <Route path="/business/discover/:slug" element={<DiscoverProfiles />} />
                <Route path="/business/discover/:slug/:id" element={<ViewProfile />} />
                <Route path="/business/shortlist" element={<Shortlist />} />
                <Route path="/business/interests" element={<Interests />} />
                <Route path="/business/settings" element={<BusinessSettings />} />
              </Route>
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
          },
        }}
      />
    </QueryClientProvider>
  );
}
