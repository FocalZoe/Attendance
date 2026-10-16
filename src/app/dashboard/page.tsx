import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect('/login');
  }

  // 依據角色導向專屬儀表板
  switch (profile.role) {
    case 'sys_admin':
      redirect('/dashboard/sys-admin');
    case 'school_admin':
      redirect('/dashboard/school-admin');
    case 'teacher':
    default:
      redirect('/dashboard/teacher');
  }
}
