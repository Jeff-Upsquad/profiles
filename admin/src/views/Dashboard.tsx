import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

interface DashboardStats {
  totalTalentUsers: number;
  totalBusinessUsers: number;
  totalProfiles: number;
  pendingReviews: number;
}

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-20 bg-gray-200 rounded animate-pulse" />
      ) : (
        <p className="mt-2 text-3xl font-semibold text-gray-900">
          {value?.toLocaleString() ?? '--'}
        </p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await api.get('/admin/dashboard/stats');
      return data.stats || data;
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Talent Users"
          value={data?.totalTalentUsers}
          loading={isLoading}
        />
        <StatCard
          label="Business Users"
          value={data?.totalBusinessUsers}
          loading={isLoading}
        />
        <StatCard
          label="Total Profiles"
          value={data?.totalProfiles}
          loading={isLoading}
        />
        <StatCard
          label="Pending Reviews"
          value={data?.pendingReviews}
          loading={isLoading}
        />
      </div>
    </div>
  );
}
