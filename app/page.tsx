'use client';

import { useAuth } from '@/lib/AuthContext';
import DemoBanner from '@/components/DemoBanner';
import DashboardReal from './dashboard-real/page';
import DashboardDemo from './dashboard-demo/page';

export default function HomePage() {
  const { mode, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <DemoBanner />
      {mode === 'authenticated' ? <DashboardReal /> : <DashboardDemo />}
    </>
  );
}