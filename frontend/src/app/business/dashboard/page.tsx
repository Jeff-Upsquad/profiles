import { redirect } from 'next/navigation';

/** Dashboard merged into Find talent hub. Nested profile routes still live under /business/dashboard/... */
export default function DashboardPage() {
  redirect('/business/hire');
}
