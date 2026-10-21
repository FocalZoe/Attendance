import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

export function DashboardRedirect() {
  const { profile, user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500 font-medium">載入身分資訊中...</p>
        </div>
      </div>
    );
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 p-6 rounded-lg max-w-md text-center space-y-3">
        <h2 className="text-base font-bold text-slate-900">帳號身分待審核</h2>
        <p className="text-xs text-slate-600">
          您的帳號目前尚未指派學校角色或權限。請聯繫學校管理主管或系統管理員為您授權。
        </p>
      </div>
    </div>
  );
}
