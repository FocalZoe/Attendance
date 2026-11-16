import { DataPanel } from '@/components/sys-admin/data-panel';
import { useSysAdmin } from '@/pages/sys-admin/context';

export function DataPage() {
  const { schools, reload } = useSysAdmin();
  return <DataPanel schools={schools} onChanged={reload} />;
}
