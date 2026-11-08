import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { PageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Navbar } from '@/components/ui/navbar';

export function DashboardRedirect() {
  const { profile, user, isLoading } = useAuthStore();

  if (isLoading) {
    return <PageSkeleton label="載入身分資訊" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.role === 'sys_admin') {
    return <Navigate to="/dashboard/sys-admin" replace />;
  }

  if (profile?.role === 'school_admin') {
    return <Navigate to="/dashboard/school-admin" replace />;
  }

  if (profile?.role === 'teacher') {
    return <Navigate to="/dashboard/teacher" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar profile={profile} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-14">
        <EmptyState
          title="帳號還沒有被指派角色"
          description="你的帳號已建立，但還沒有加入學校或取得權限。請聯繫學校主管或系統總管，請他們為你指派。指派完成後重新登入即可使用。"
        />
      </main>
    </div>
  );
}
