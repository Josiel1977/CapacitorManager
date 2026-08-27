'use client';

import { useAuth } from '@/lib/AuthContext';
import PublicLanding from '@/components/PublicLanding';
import DashboardReal from './dashboard-real/page';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-[60vh] animate-pulse bg-slate-50" aria-label="Carregando" />;
  }

  return isAuthenticated ? <DashboardReal /> : <PublicLanding />;
}
