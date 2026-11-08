import { supabase } from '@/lib/supabase';

const BUCKET = 'attendance-snapshots';
const LIST_PAGE = 100;
const REMOVE_BATCH = 100;

/** Thrown with a user-facing step name so the UI can say what failed */
export class HardDeleteError extends Error {
  constructor(
    public step: string,
    public cause?: unknown
  ) {
    super(`Hard delete failed at: ${step}`);
    this.name = 'HardDeleteError';
  }
}

/** Remove every snapshot file stored under a class folder. Returns how many files were removed. */
export async function removeClassSnapshots(classId: string): Promise<number> {
  const storage = supabase.storage.from(BUCKET);
  let removed = 0;

  // Always list from offset 0: removed files drop out of the listing
  for (;;) {
    const { data, error } = await storage.list(classId, { limit: LIST_PAGE, offset: 0 });
    if (error) throw new HardDeleteError('list-snapshots', error);

    const files = (data ?? []).filter((item) => item.name && item.id !== null);
    if (files.length === 0) break;

    const paths = files.map((f) => `${classId}/${f.name}`);
    for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
      const { error: removeError } = await storage.remove(paths.slice(i, i + REMOVE_BATCH));
      if (removeError) throw new HardDeleteError('remove-snapshots', removeError);
    }
    removed += paths.length;

    if (files.length < LIST_PAGE) break;
  }

  return removed;
}

export interface SchoolDeleteResult {
  classes: number;
  students: number;
  accounts: number;
  snapshots: number;
}

/** Delete a whole school: photos first, then database rows. The database is untouched if photo cleanup fails. */
export async function deleteSchoolEverything(
  schoolId: string,
  options: { deleteAccounts: boolean }
): Promise<SchoolDeleteResult> {
  const { data: classRows, error: classErr } = await supabase
    .from('classes')
    .select('id')
    .eq('school_id', schoolId);
  if (classErr) throw new HardDeleteError('list-classes', classErr);

  let snapshots = 0;
  for (const row of classRows ?? []) {
    snapshots += await removeClassSnapshots(row.id as string);
  }

  const { data, error } = await supabase.rpc('delete_school_cascade', {
    p_school_id: schoolId,
    p_delete_accounts: options.deleteAccounts,
  });
  if (error) throw new HardDeleteError('delete-school', error);

  const result = (data ?? {}) as { classes?: number; students?: number; accounts?: number };
  return {
    classes: result.classes ?? 0,
    students: result.students ?? 0,
    accounts: result.accounts ?? 0,
    snapshots,
  };
}

/** Delete one class with its students, attendance records and photos */
export async function deleteClassEverything(classId: string): Promise<{ snapshots: number }> {
  const snapshots = await removeClassSnapshots(classId);
  const { error } = await supabase.from('classes').delete().eq('id', classId);
  if (error) throw new HardDeleteError('delete-class', error);
  return { snapshots };
}

/** Delete one rollcall: its photo first, then the row (student records cascade). Row stays if photo removal fails. */
export async function deleteSessionRecord(sessionId: string, snapshotPath: string | null): Promise<void> {
  if (snapshotPath) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([snapshotPath]);
    if (removeError) throw new HardDeleteError('remove-snapshot', removeError);
  }
  const { error } = await supabase.from('attendance_sessions').delete().eq('id', sessionId);
  if (error) throw new HardDeleteError('delete-session', error);
}

/** Delete one student; attendance records cascade */
export async function deleteStudentRecord(studentId: string): Promise<void> {
  const { error } = await supabase.from('students').delete().eq('id', studentId);
  if (error) throw new HardDeleteError('delete-student', error);
}

/** Delete a login account and its profile */
export async function deleteAccount(profileId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_user_account', { p_profile_id: profileId });
  if (error) throw new HardDeleteError('delete-account', error);
}
