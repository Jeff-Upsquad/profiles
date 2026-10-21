'use client';

import { Suspense } from 'react';
import Dashboard from '@/views/Dashboard';

export default function DashboardPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
