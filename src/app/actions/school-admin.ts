'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentProfile } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function createClassAction(formData: FormData): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== 'school_admin' && profile.role !== 'sys_admin')) {
    return;
  }

  const name = formData.get('name') as string;
  const grade = formData.get('grade') as string;
  const academicYear = formData.get('academic_year') as string;
  const schoolId = (formData.get('school_id') as string) || profile.school_id;

  if (!name || !grade || !academicYear || !schoolId) {
    return;
  }

  const supabase = await createClient();

  const { error } = await supabase.from('classes').insert({
    school_id: schoolId,
    name: name.trim(),
    grade: grade.trim(),
    academic_year: academicYear.trim(),
  });

  if (error) {
    console.error('Error creating class:', error);
    return;
  }

  revalidatePath('/dashboard/school-admin');
}

export async function createTeacherAccountAction(formData: FormData): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== 'school_admin' && profile.role !== 'sys_admin')) {
    return;
  }

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;
  const schoolId = (formData.get('school_id') as string) || profile.school_id;

  if (!email || !password || !name || !schoolId) {
    return;
  }

  try {
    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email: email.trim(),
      password: password.trim(),
      email_confirm: true,
      user_metadata: {
        name: name.trim(),
        role: 'teacher',
        school_id: schoolId,
      },
    });

    if (error) {
      console.error('Error provisioning teacher:', error);
      return;
    }

    if (data?.user) {
      const supabase = await createClient();
      await supabase.from('profiles').upsert({
        id: data.user.id,
        school_id: schoolId,
        role: 'teacher',
        name: name.trim(),
        email: email.trim(),
      });
    }

    revalidatePath('/dashboard/school-admin');
  } catch (err: unknown) {
    console.error('Error in createTeacherAccountAction:', err);
  }
}
