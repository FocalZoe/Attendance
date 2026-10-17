'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Profile } from '@/types/database';
import { Camera, LogOut, School, Shield, User, Search } from 'lucide-react';

interface NavbarProps {
  profile?: Profile | null;
}

export function Navbar({ profile }: NavbarProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'sys_admin':
        return (
          <Badge variant="default" className="bg-slate-900 text-white border-transparent">
            <Shield className="w-3 h-3 mr-1 inline" /> 系統總管
          </Badge>
        );
      case 'school_admin':
        return (
          <Badge variant="success">
            <School className="w-3 h-3 mr-1 inline" /> 學校主管
          </Badge>
        );
      case 'teacher':
        return (
          <Badge variant="info">
            <User className="w-3 h-3 mr-1 inline" /> 任課教師
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link href="/" className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold">
              <Camera className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-slate-900 leading-tight">
                班級自動化點名系統
              </span>
              <span className="text-[10px] text-slate-500 font-medium">校園智慧出勤平台</span>
            </div>
          </Link>

          {profile && (
            <nav className="hidden md:flex items-center space-x-4 pl-4 border-l border-slate-200 text-sm font-semibold">
              <Link
                href="/dashboard"
                className="text-slate-700 hover:text-blue-600 px-2 py-1 rounded transition-colors"
              >
                控制台
              </Link>
              {profile.role === 'teacher' && (
                <Link
                  href="/dashboard/teacher"
                  className="text-slate-700 hover:text-blue-600 px-2 py-1 rounded transition-colors"
                >
                  任教班級與點名
                </Link>
              )}
              {profile.role === 'school_admin' && (
                <Link
                  href="/dashboard/school-admin"
                  className="text-slate-700 hover:text-blue-600 px-2 py-1 rounded transition-colors"
                >
                  校務名冊管理
                </Link>
              )}
              {profile.role === 'sys_admin' && (
                <Link
                  href="/dashboard/sys-admin"
                  className="text-slate-700 hover:text-blue-600 px-2 py-1 rounded transition-colors"
                >
                  學校組織總覽
                </Link>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <Link href="/parent-query">
            <Button variant="outline" size="sm" className="hidden sm:inline-flex">
              <Search className="w-3.5 h-3.5 mr-1.5" />
              家長查勤
            </Button>
          </Link>

          {profile ? (
            <div className="flex items-center space-x-3">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-sm font-bold text-slate-900">{profile.name}</span>
                <span className="text-xs text-slate-500">{profile.school?.name || profile.email}</span>
              </div>
              {getRoleBadge(profile.role)}
              <Button variant="ghost" size="sm" onClick={handleSignOut} title="登出系統">
                <LogOut className="w-4 h-4 text-slate-600" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link href="/register">
                <Button variant="outline" size="sm" className="hidden sm:inline-flex">
                  開通學校
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="primary" size="sm">
                  教職員登入
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
