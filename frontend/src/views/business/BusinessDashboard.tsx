import { useAuth } from '@/context/AuthContext';

export default function BusinessDashboard() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h1 className="text-2xl font-bold text-gray-900">
        Welcome{user?.company_name ? `, ${user.company_name}` : ''}!
      </h1>
      <p className="mt-2 text-sm text-gray-500 text-center max-w-md">
        Select a category from the sidebar to browse talents shared with you.
      </p>
    </div>
  );
}
