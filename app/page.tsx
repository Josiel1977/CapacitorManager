'use client';

import { useAuth } from '@/lib/AuthContext';
import DemoBanner from '@/components/DemoBanner';
import DashboardReal from './dashboard-real/page';
import DashboardDemo from './dashboard-demo/page';

export default function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <DemoBanner />
      {isAuthenticated ? <DashboardReal /> : <DashboardDemo />}
    </>
  );
}
