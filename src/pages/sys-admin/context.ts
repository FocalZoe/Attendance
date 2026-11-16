import { useOutletContext } from 'react-router-dom';
import type { SchoolAdminInfo } from '@/components/sys-admin/school-admin-modal';
import type { School } from '@/types/database';

export type AdminRow = SchoolAdminInfo & { school_id: string | null };

/** Data and actions the system admin layout shares with its pages (schools, accounts, data) */
export interface SysAdminContext {
  schools: School[];
  allAdmins: AdminRow[];
  loading: boolean;
  reload: () => Promise<void>;
  setSchoolDialogOpen: (open: boolean) => void;
  setDeleteTarget: (school: School | null) => void;
}

export function useSysAdmin() {
  return useOutletContext<SysAdminContext>();
}

export function adminSummary(admins: AdminRow[]): string {
  const active = admins.filter((a) => a.is_active !== false);
  return active.length === 0 ? '' : active.map((a) => a.name).join('、');
}
