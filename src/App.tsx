import * as React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import type { UserRole } from '@/types/database';

import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ParentQueryPage } from '@/pages/ParentQueryPage';
import { DashboardRedirect } from '@/pages/DashboardRedirect';
import { SysAdminDashboard } from '@/pages/SysAdminDashboard';
import { SchoolAdminDashboard } from '@/pages/SchoolAdminDashboard';
import { TeacherDashboard } from '@/pages/TeacherDashboard';
import { Toaster } from '@/components/ui/sonner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, isLoading, isInitialized } = useAuthStore();

  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500 font-medium">驗證系統憑證中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export function App() {
  const { initialize } = useAuthStore();

  React.useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/parent-query" element={<ParentQueryPage />} />

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
        />
        <Route
          path="/dashboard/school-admin"
          element={
            <ProtectedRoute allowedRoles={['school_admin', 'sys_admin']}>
              <SchoolAdminDashboard />
            </ProtectedRoute>
          }
        />
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
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
