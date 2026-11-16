import * as React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import type { UserRole } from '@/types/database';

import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ParentQueryPage } from '@/pages/ParentQueryPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { DashboardRedirect } from '@/pages/DashboardRedirect';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MotionProvider } from '@/components/motion/motion-provider';
import { PageSkeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, isLoading, isInitialized } = useAuthStore();

  if (isLoading || !isInitialized) {
    return <PageSkeleton label="確認登入狀態" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && (!profile || !allowedRoles.includes(profile.role))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Dashboards load on demand so the first screen (login, parent query) stays light
const SysAdminDashboard = React.lazy(() => import('@/pages/SysAdminDashboard').then((mod) => ({ default: mod.SysAdminDashboard })));
const SchoolAdminDashboard = React.lazy(() => import('@/pages/SchoolAdminDashboard').then((mod) => ({ default: mod.SchoolAdminDashboard })));
const TeacherDashboard = React.lazy(() => import('@/pages/TeacherDashboard').then((mod) => ({ default: mod.TeacherDashboard })));
const ClassesPage = React.lazy(() => import('@/pages/school-admin/ClassesPage').then((mod) => ({ default: mod.ClassesPage })));
const TeachersPage = React.lazy(() => import('@/pages/school-admin/TeachersPage').then((mod) => ({ default: mod.TeachersPage })));
const PeriodsPage = React.lazy(() => import('@/pages/school-admin/PeriodsPage').then((mod) => ({ default: mod.PeriodsPage })));
const SchoolsPage = React.lazy(() => import('@/pages/sys-admin/SchoolsPage').then((mod) => ({ default: mod.SchoolsPage })));
const AccountsPage = React.lazy(() => import('@/pages/sys-admin/AccountsPage').then((mod) => ({ default: mod.AccountsPage })));
const DataPage = React.lazy(() => import('@/pages/sys-admin/DataPage').then((mod) => ({ default: mod.DataPage })));

export function App() {
  const { initialize } = useAuthStore();

  React.useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <MotionProvider>
    <TooltipProvider delayDuration={300}>
    <BrowserRouter>
      <React.Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/parent-query" element={<ParentQueryPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* 需認證之控制台路由 */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/sys-admin"
          element={
            <ProtectedRoute allowedRoles={['sys_admin']}>
              <SysAdminDashboard />
            </ProtectedRoute>
          }
       >
          <Route index element={<SchoolsPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="data" element={<DataPage />} />
        </Route>
        <Route
          path="/dashboard/school-admin"
          element={
            <ProtectedRoute allowedRoles={['school_admin', 'sys_admin']}>
              <SchoolAdminDashboard />
            </ProtectedRoute>
          }
        >
          <Route index element={<ClassesPage />} />
          <Route path="teachers" element={<TeachersPage />} />
          <Route path="periods" element={<PeriodsPage />} />
        </Route>
        <Route
          path="/dashboard/teacher"
          element={
            <ProtectedRoute allowedRoles={['teacher', 'school_admin', 'sys_admin']}>
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />

        {/* 兜底重定向 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </React.Suspense>
      <Toaster />
    </BrowserRouter>
    </TooltipProvider>
    </MotionProvider>
  );
}

export default App;
