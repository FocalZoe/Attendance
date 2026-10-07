import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore, type UserRole } from '@/store/useAuthStore'
import { useParentStore } from '@/store/useParentStore'

interface StaffRoleGuardProps {
  allowedRoles: UserRole[]
}

/**
 * 取得特定角色之預設主頁
 */
const getRoleDefaultPath = (role: UserRole): string => {
  switch (role) {
    case 'teacher':
      return '/Dashboard'
    case 'school_admin':
      return '/Management'
    case 'parent':
      return '/History'
    default:
      return '/login'
  }
}

/**
 * 教職員角色路由守衛 (StaffRoleGuard)
 * 驗證是否已登入且符合特定角色，若無權限則自動重導向至該角色具備權限之預設首頁
 */
export const StaffRoleGuard: React.FC<StaffRoleGuardProps> = ({ allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleDefaultPath(user.role)} replace />
  }

  return <Outlet />
}

/**
 * 歷史紀錄存取守衛 (HistoryAccessGuard)
 * 允許任一具備憑證之角色進入（教職員 Session 或家長臨時憑證）
 */
export const HistoryAccessGuard: React.FC = () => {
  const { isAuthenticated: isStaffAuth, isLoading } = useAuthStore()
  const { isAuthenticated: isParentAuth } = useParentStore()

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isStaffAuth && !isParentAuth) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
