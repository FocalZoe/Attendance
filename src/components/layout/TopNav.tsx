import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Menu,
  School,
  User,
  LayoutDashboard,
  Users,
  History as HistoryIcon,
  Sparkles,
  GraduationCap
} from 'lucide-react'
import { useAuthStore, type UserRole } from '@/store/useAuthStore'
import { useParentStore } from '@/store/useParentStore'
import { useLayoutStore } from '@/store/useLayoutStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: Array<'school_admin' | 'teacher' | 'parent'>
}

const NAV_ITEMS: NavItem[] = [
  {
    title: '即時監控',
    href: '/Dashboard',
    icon: LayoutDashboard,
    roles: ['teacher'],
  },
  {
    title: '班級與名冊',
    href: '/Management',
    icon: Users,
    roles: ['school_admin', 'teacher'],
  },
  {
    title: '歷史考勤',
    href: '/History',
    icon: HistoryIcon,
    roles: ['school_admin', 'teacher', 'parent'],
  },
]

const ROLE_DISPLAY_MAP: Record<UserRole, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  school_admin: { label: '學校總管', variant: 'default' },
  teacher: { label: '授課教師', variant: 'secondary' },
  parent: { label: '家長視角', variant: 'outline' },
}

export const TopNav: React.FC = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { student: parentStudent, isAuthenticated: isParentAuth, clearParentAuth } = useParentStore()
  const { isMobileNavOpen, setMobileNavOpen } = useLayoutStore()

  const currentRole: UserRole = isParentAuth ? 'parent' : (user?.role || 'teacher')
  const displayName = isParentAuth ? `${parentStudent?.name || '學生'} 家長` : (user?.name || '使用者')
  const displayEmail = isParentAuth ? `學號 ${parentStudent?.studentNo || ''}` : (user?.email || '無電子郵件')

  const accessibleItems = NAV_ITEMS.filter((item) => item.roles.includes(currentRole))

  const handleLogout = async () => {
    if (isParentAuth) {
      clearParentAuth()
      navigate('/')
    } else {
      await logout()
      navigate('/login')
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6 shadow-sm">
        <div className="flex items-center gap-4 md:gap-6">
          {/* 手機端選單漢堡按鈕 */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="開啟選單"
          >
            <Menu className="h-5 w-5 text-primary" />
          </Button>

          {/* 品牌標識區 */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="hidden sm:inline-block font-bold tracking-tight text-foreground">
              Zoe 智慧考勤
            </span>
          </div>

          {/* 桌機端導覽連結 */}
          <nav className="hidden md:flex items-center gap-1">
            {accessibleItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-muted text-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </NavLink>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* 當前身分 Badge */}
          <Badge variant={ROLE_DISPLAY_MAP[currentRole].variant} className="hidden sm:inline-flex bg-primary text-primary-foreground">
            {ROLE_DISPLAY_MAP[currentRole].label}
          </Badge>

          {/* 使用者選單 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2 border-border text-foreground hover:bg-muted">
                <User className="h-4 w-4" />
                <span className="hidden max-w-[120px] truncate sm:inline">{displayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-border">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-foreground">{displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{displayEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive hover:bg-destructive/10">
                {isParentAuth ? '退出家長查閱' : '登出系統'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* 手機端側邊抽屜導航 */}
      <Sheet open={isMobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col bg-background border-r-border">
          <SheetHeader className="border-b border-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <SheetTitle className="text-left font-bold text-foreground">Zoe 智慧考勤</SheetTitle>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-1 p-3">
            {accessibleItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-muted text-foreground font-semibold shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.title}</span>
                </NavLink>
              )
            })}
          </div>

          <div className="border-t border-border p-4">
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                {currentRole === 'parent' ? (
                  <GraduationCap className="h-4 w-4" />
                ) : (
                  <School className="h-4 w-4" />
                )}
                <span>
                  {currentRole === 'school_admin'
                    ? '全校總管模式'
                    : currentRole === 'teacher'
                    ? '授課教師模式'
                    : '家長免登模式'}
                </span>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
