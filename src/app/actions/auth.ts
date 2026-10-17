'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface RegisterSchoolResult {
  success: boolean;
  error?: string;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

/**
 * 登入處理函式（支援環境變數透明比對與常規帳密驗證）
 */
export async function loginAction(
  prevState: LoginResult | null,
  formData: FormData
): Promise<LoginResult> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = (formData.get('password') as string)?.trim();

  if (!email || !password) {
    return { success: false, error: '請輸入電子信箱與密碼' };
  }

  const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD?.trim();
  const initialAdminName = process.env.INITIAL_ADMIN_NAME?.trim() || '平台系統總管';

  // 1. 環境變數透明比對：若符合系統總管環境變數，直接在背景自動預置/同步並登入
  if (
    initialAdminEmail &&
    initialAdminPassword &&
    email === initialAdminEmail &&
    password === initialAdminPassword
  ) {
    try {
      const adminSupabase = createAdminClient();

      // 檢查 Supabase 是否已有此使用者
      const { data: existingProfile } = await adminSupabase
        .from('profiles')
        .select('id, role')
        .eq('email', email)
        .maybeSingle();

      if (!existingProfile) {
        // 自動在背景建立 Auth 使用者與 Profile
        const { data: newUserData, error: createError } = await adminSupabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            name: initialAdminName,
            role: 'sys_admin',
            school_id: null,
          },
        });

        if (createError) {
          return { success: false, error: `系統總管初始化失敗: ${createError.message}` };
        }

        if (newUserData?.user) {
          await adminSupabase.from('profiles').upsert({
            id: newUserData.user.id,
            school_id: null,
            role: 'sys_admin',
            name: initialAdminName,
            email,
          });
        }
      } else {
        // 確保角色為 sys_admin，並同步最新密碼
        await adminSupabase.auth.admin.updateUserById(existingProfile.id, {
          password,
          email_confirm: true,
        });
        await adminSupabase
          .from('profiles')
          .update({ role: 'sys_admin', school_id: null })
          .eq('id', existingProfile.id);
      }

      // 使用伺服器客戶端建立標準會話 Cookie
      const supabase = await createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        return { success: false, error: `系統總管登入失敗: ${signInError.message}` };
      }

      return { success: true, redirectTo: '/dashboard/sys-admin' };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '系統總管驗證過程發生未預期錯誤';
      return { success: false, error: errorMsg };
    }
  }

  // 2. 常規使用者驗證 (學校主管、任課教師)
  try {
    const supabase = await createClient();
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return {
        success: false,
        error:
          signInError.message === 'Invalid login credentials'
            ? '帳號或密碼錯誤，請重新確認'
            : signInError.message,
      };
    }

    // 依 Profile 角色決定導向
    if (authData?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profile?.role === 'sys_admin') {
        return { success: true, redirectTo: '/dashboard/sys-admin' };
      }
      if (profile?.role === 'school_admin') {
        return { success: true, redirectTo: '/dashboard/school-admin' };
      }
      if (profile?.role === 'teacher') {
        return { success: true, redirectTo: '/dashboard/teacher' };
      }
    }

    return { success: true, redirectTo: '/dashboard' };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : '登入過程發生未預期錯誤';
    return { success: false, error: errorMsg };
  }
}

/**
 * 學校主管開通學校單位與註冊處理函式
 */
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

    // 1. 檢查學校代碼是否已存在（支援既有學校加入多主管）
    const { data: existingSchool, error: checkSchoolError } = await adminSupabase
      .from('schools')
      .select('id, name')
      .eq('code', schoolCode)
      .maybeSingle();

    if (checkSchoolError) {
      return { success: false, error: `檢查學校代碼失敗: ${checkSchoolError.message}` };
    }

    let targetSchoolId: string;

    if (existingSchool) {
      // 學校代碼已存在（例如由系統總管預置或已有學校），將新註冊主管加入該校管理團隊
      targetSchoolId = existingSchool.id;
    } else {
      // 學校代碼不存在，建立新學校實體
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
      targetSchoolId = newSchool.id;
    }

    // 2. 檢查此 Email 是否已被註冊
    const { data: existingUser } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    let userId: string;

    if (existingUser) {
      // 若該信箱已存在，更新其密碼並設為該校主管
      userId = existingUser.id;
      await adminSupabase.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: {
          name: adminName,
          role: 'school_admin',
          school_id: targetSchoolId,
          phone: phone || null,
        },
      });
    } else {
      // 建立學校管理員 Auth 使用者 (自動確認信箱)
      const { data: userData, error: createUserError } = await adminSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: adminName,
          role: 'school_admin',
          school_id: targetSchoolId,
          phone: phone || null,
        },
      });

      if (createUserError || !userData?.user) {
        return { success: false, error: `建立管理員帳號失敗: ${createUserError?.message}` };
      }
      userId = userData.user.id;
    }

    // 3. 同步寫入 Profile 表
    const { error: profileError } = await adminSupabase.from('profiles').upsert({
      id: userId,
      school_id: targetSchoolId,
      role: 'school_admin',
      name: adminName,
      email,
      phone: phone || null,
    });

    if (profileError) {
      console.error('Profile upsert warning:', profileError);
    }

    // 4. 為當前客戶端會話進行登入認證
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return { success: true }; // 帳號已建立/更新，引導手動登入
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : '開通學校時發生未預期錯誤';
    return { success: false, error: errorMsg };
  }
}
