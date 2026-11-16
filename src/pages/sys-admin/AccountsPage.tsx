import { AccountsPanel } from '@/components/sys-admin/accounts-panel';
import { useSysAdmin } from '@/pages/sys-admin/context';

export function AccountsPage() {
  const { schools } = useSysAdmin();
  return <AccountsPanel schools={schools} />;
}
