'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface RegisterSchoolResult {
  success: boolean;
  error?: string;
}

export async function registerSchoolAction(
  prevState: RegisterSchoolResult | null,
  formData: FormData
): Promise<RegisterSchoolResult> {
  const schoolName = (formData.get('school_name') as string)?.trim();
  const schoolCode = (formData.get('school_code') as string)?.trim().toUpperCase();
  const adminName = (formData.get('admin_name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = (formData.get('password') as string)?.trim();
  const phone = (formData.get('phone') as string)?.trim();

  if (!schoolName || !schoolCode || !adminName || !email || !password) {
    return { success: false, error: '請完整填寫學校資訊與管理員帳號資料' };
  }

  if (password.length < 6) {
    return { success: false, error: '密碼長度至少需 6 個字元' };
  }

  try {
    const adminSupabase = createAdminClient();

    // 1. 檢查學校代碼是否重複
    const { data: existingSchool, error: checkSchoolError } = await adminSupabase
      .from('schools')
      .select('id')
      .eq('code', schoolCode)
      .maybeSingle();

    if (checkSchoolError) {
      return { success: false, error: `檢查學校代碼失敗: ${checkSchoolError.message}` };
    }

    if (existingSchool) {
      return { success: false, error: `學校代碼「${schoolCode}」已被使用，請更換代碼` };
    }

    // 2. 建立學校實體
    const { data: newSchool, error: createSchoolError } = await adminSupabase
      .from('schools')
      .insert({
        name: schoolName,
        code: schoolCode,
      })
      .select('id')
      .single();

    if (createSchoolError || !newSchool) {
      return { success: false, error: `建立學校資料失敗: ${createSchoolError?.message}` };
    }

    // 3. 建立學校管理員 Auth 使用者 (自動確認信箱)
    const { data: userData, error: createUserError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: adminName,
        role: 'school_admin',
        school_id: newSchool.id,
        phone: phone || null,
      },
    });

    if (createUserError || !userData?.user) {
      // 回滾學校建立
      await adminSupabase.from('schools').delete().eq('id', newSchool.id);
      return { success: false, error: `建立管理員帳號失敗: ${createUserError?.message}` };
    }

    // 4. 同步寫入 Profile 表
    const { error: profileError } = await adminSupabase.from('profiles').upsert({
      id: userData.user.id,
      school_id: newSchool.id,
      role: 'school_admin',
      name: adminName,
      email,
      phone: phone || null,
    });

    if (profileError) {
      console.error('Profile upsert warning:', profileError);
    }

    // 5. 為當前客戶端會話進行登入認證
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return { success: true }; // 帳號已建立，引導手動登入
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : '開通學校時發生未預期錯誤';
    return { success: false, error: errorMsg };
  }
}
