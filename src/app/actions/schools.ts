'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentProfile } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * 系統總管新增學校實體
 */
export async function createSchoolAction(formData: FormData): Promise<void> {
  const name = formData.get('name') as string;
  const code = formData.get('code') as string;

  if (!name || !code) {
    return;
  }

  const supabase = await createClient();

  const { error } = await supabase.from('schools').insert({
    name: name.trim(),
    code: code.trim().toUpperCase(),
  });

  if (error) {
    console.error('Error creating school:', error);
    return;
  }

  revalidatePath('/dashboard/sys-admin');
}

/**
 * 系統總管解任特定學校主管
 */
export async function removeSchoolAdminAction(profileId: string): Promise<{ success: boolean; error?: string }> {
  const currentProfile = await getCurrentProfile();
  if (!currentProfile || currentProfile.role !== 'sys_admin') {
    return { success: false, error: '權限不足，僅系統總管可執行解任操作' };
  }

  try {
    const adminSupabase = createAdminClient();

    // 將該員的 school_id 解除綁定，降級為一般教師身分
    const { error } = await adminSupabase
      .from('profiles')
      .update({
        school_id: null,
        role: 'teacher',
      })
      .eq('id', profileId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/sys-admin');
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : '解任操作失敗';
    return { success: false, error: errorMsg };
  }
}

/**
 * 系統總管直接為特定學校指派/建立主管帳號
 */
export async function assignSchoolAdminAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const currentProfile = await getCurrentProfile();
  if (!currentProfile || currentProfile.role !== 'sys_admin') {
    return { success: false, error: '權限不足，僅系統總管可指派學校主管' };
  }

  const schoolId = (formData.get('school_id') as string)?.trim();
  const name = (formData.get('name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = (formData.get('password') as string)?.trim();
  const phone = (formData.get('phone') as string)?.trim();

  if (!schoolId || !name || !email || !password) {
    return { success: false, error: '請完整填寫主管姓名、信箱與預設密碼' };
  }

  try {
    const adminSupabase = createAdminClient();

    // 檢查該 Email 是否已有帳號
    const { data: existingUser } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      await adminSupabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: {
          name,
          role: 'school_admin',
          school_id: schoolId,
          phone: phone || null,
        },
      });
    } else {
      const { data: newUserData, error: createError } = await adminSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          role: 'school_admin',
          school_id: schoolId,
          phone: phone || null,
        },
      });

      if (createError || !newUserData?.user) {
        return { success: false, error: createError?.message || '建立主管帳號失敗' };
      }
      userId = newUserData.user.id;
    }

    // 同步寫入 profiles
    await adminSupabase.from('profiles').upsert({
      id: userId,
      school_id: schoolId,
      role: 'school_admin',
      name,
      email,
      phone: phone || null,
    });

    revalidatePath('/dashboard/sys-admin');
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : '指派主管失敗';
    return { success: false, error: errorMsg };
  }
}
