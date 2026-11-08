import { supabase } from '@/lib/supabase';

const BUCKET = 'attendance-snapshots';
const LIST_PAGE = 100;
const REMOVE_BATCH = 100;

/** Thrown with a step name so callers can tell what failed; the original error is kept as `cause` */
export class HardDeleteError extends Error {
  constructor(
    public step: string,
    public cause?: unknown
  ) {
    super(`Hard delete failed at: ${step}`);
    this.name = 'HardDeleteError';
  }
}

/**
 * Remove files and verify it really happened. Storage returns no error when a policy
 * silently blocks the delete; it just reports fewer removed files than requested.
 */
async function removeFiles(paths: string[]): Promise<number> {
  const storage = supabase.storage.from(BUCKET);
  let removed = 0;
  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const batch = paths.slice(i, i + REMOVE_BATCH);
    const { data, error } = await storage.remove(batch);
    if (error) throw new HardDeleteError('remove-snapshots', error);
    if ((data?.length ?? 0) < batch.length) {
      throw new HardDeleteError('remove-snapshots', {
        message: 'Storage did not remove every file (check the delete policy)',
      });
    }
    removed += batch.length;
  }
  return removed;
}

/** Remove every snapshot file stored under a class folder. Returns how many files were removed. */
export async function removeClassSnapshots(classId: string): Promise<number> {
  const storage = supabase.storage.from(BUCKET);
  let removed = 0;

  // List from offset 0 each time: removed files drop out of the listing,
  // and removeFiles() throws if they did not, so this cannot loop forever.
  for (;;) {
    const { data, error } = await storage.list(classId, { limit: LIST_PAGE, offset: 0 });
    if (error) throw new HardDeleteError('list-snapshots', error);

    const files = (data ?? []).filter((item) => item.name && item.id !== null);
    if (files.length === 0) break;

    removed += await removeFiles(files.map((f) => `${classId}/${f.name}`));
    if (files.length < LIST_PAGE) break;
  }

  return removed;
}

export interface PhotoCleanup {
  removed: number;
  /** True when the database rows are gone but some photo files could not be removed */
  failed: boolean;
}

/** Best-effort photo cleanup after the database rows are already deleted */
async function cleanupClassPhotos(classIds: string[]): Promise<PhotoCleanup> {
  let removed = 0;
  let failed = false;
  for (const id of classIds) {
    try {
      removed += await removeClassSnapshots(id);
    } catch (err) {
      console.error('Photo cleanup failed for class', id, err);
      failed = true;
    }
  }
  return { removed, failed };
}

export interface SchoolDeleteResult {
  classes: number;
  students: number;
  accounts: number;
  snapshots: number;
  photosFailed: boolean;
}

/**
 * Delete a whole school. Database rows go first so a failed delete never costs the photos;
 * photo files are cleaned afterwards and reported if any could not be removed.
 */
export async function deleteSchoolEverything(
  schoolId: string,
  options: { deleteAccounts: boolean }
): Promise<SchoolDeleteResult> {
  const { data: classRows, error: classErr } = await supabase
    .from('classes')
    .select('id')
    .eq('school_id', schoolId);
  if (classErr) throw new HardDeleteError('list-classes', classErr);

  const { data, error } = await supabase.rpc('delete_school_cascade', {
    p_school_id: schoolId,
    p_delete_accounts: options.deleteAccounts,
  });
  if (error) throw new HardDeleteError('delete-school', error);

  const photos = await cleanupClassPhotos((classRows ?? []).map((row) => row.id as string));

  const result = (data ?? {}) as { classes?: number; students?: number; accounts?: number };
  return {
    classes: result.classes ?? 0,
    students: result.students ?? 0,
    accounts: result.accounts ?? 0,
    snapshots: photos.removed,
    photosFailed: photos.failed,
  };
}

/** Delete one class with its students and attendance records, then its photos */
export async function deleteClassEverything(classId: string): Promise<PhotoCleanup> {
  const { error } = await supabase.from('classes').delete().eq('id', classId);
  if (error) throw new HardDeleteError('delete-class', error);
  return cleanupClassPhotos([classId]);
}

/** Delete one rollcall (student records cascade), then its photo */
export async function deleteSessionRecord(sessionId: string, snapshotPath: string | null): Promise<PhotoCleanup> {
  const { error } = await supabase.from('attendance_sessions').delete().eq('id', sessionId);
  if (error) throw new HardDeleteError('delete-session', error);
  if (!snapshotPath) return { removed: 0, failed: false };
  try {
    return { removed: await removeFiles([snapshotPath]), failed: false };
  } catch (err) {
    console.error('Photo cleanup failed for session', sessionId, err);
    return { removed: 0, failed: true };
  }
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
