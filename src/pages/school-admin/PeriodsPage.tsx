import { SchoolPeriodsSection } from '@/components/attendance/SchoolPeriodsSection';
import { useSchoolAdmin } from '@/pages/school-admin/context';

export function PeriodsPage() {
  const { schoolId } = useSchoolAdmin();
  return <div>{schoolId && <SchoolPeriodsSection schoolId={schoolId} />}</div>;
}
