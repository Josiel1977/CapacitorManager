'use client';

import { useAuth } from '@/lib/AuthContext';
import PublicLanding from '@/components/PublicLanding';
import DashboardReal from '@/app/dashboard-real/page';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PublicLanding />;
  }

  return isAuthenticated ? <DashboardReal /> : <PublicLanding />;
}
