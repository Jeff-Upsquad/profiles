import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface ProtectedRouteProps {
  requiredRole: 'talent' | 'business' | 'admin';
}

export default function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== requiredRole) {
    const redirectMap: Record<string, string> = {
      talent: '/talent/dashboard',
      business: '/business/dashboard',
      admin: '/admin/dashboard',
    };
    return <Navigate to={redirectMap[user.role] || '/'} replace />;
  }

  return <Outlet />;
}
