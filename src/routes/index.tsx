import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { ParentEntryPage } from '@/features/auth/ParentEntryPage'
import { RegisterSchoolPage } from '@/features/auth/RegisterSchoolPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ManagementPage } from '@/features/management/ManagementPage'
import { HistoryPage } from '@/features/history/HistoryPage'
import { StaffRoleGuard, HistoryAccessGuard } from '@/components/guard/RouteGuard'

export const router = createBrowserRouter([
  // 1. 公開與免登認證路由（使用 AuthLayout）
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/',
        element: <ParentEntryPage />,
      },
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/RegisterSchoolPage',
        element: <RegisterSchoolPage />,
      },
    ],
  },
  // 2. 主應用工作台路由（使用 AppLayout 搭配 Sidebar 與 Header）
  {
    element: <AppLayout />,
    children: [
      // 即時監控：僅限授課教師/班導師存取
      {
        element: <StaffRoleGuard allowedRoles={['teacher']} />,
        children: [
          {
            path: '/Dashboard',
            element: <DashboardPage />,
          },
        ],
      },
      // 班級名冊管理：學校總管與授課教師皆可存取
      {
        element: <StaffRoleGuard allowedRoles={['school_admin', 'teacher']} />,
        children: [
          {
            path: '/Management',
            element: <ManagementPage />,
          },
        ],
      },
      // 歷史紀錄簿：教職員 Session 或家長臨時憑證皆可存取
      {
        element: <HistoryAccessGuard />,
        children: [
          {
            path: '/History',
            element: <HistoryPage />,
          },
        ],
      },
    ],
  },
  // 3. 未匹配路徑預設重導向回根目錄
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
