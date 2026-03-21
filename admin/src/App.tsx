import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import AdminLayout from '@/components/layout/AdminLayout';
import AdminLogin from '@/pages/auth/AdminLogin';
import Dashboard from '@/pages/Dashboard';
import CategoryList from '@/pages/categories/CategoryList';
import FieldManager from '@/pages/categories/FieldManager';
import ReviewQueue from '@/pages/profiles/ReviewQueue';
import ProfileReview from '@/pages/profiles/ProfileReview';
import UserManagement from '@/pages/users/UserManagement';
import RecycleBin from '@/pages/RecycleBin';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
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
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="categories" element={<CategoryList />} />
              <Route path="categories/:id/fields" element={<FieldManager />} />
              <Route path="reviews" element={<ReviewQueue />} />
              <Route path="reviews/:id" element={<ProfileReview />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="recycle-bin" element={<RecycleBin />} />
            </Route>
          </Routes>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                fontSize: '14px',
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
