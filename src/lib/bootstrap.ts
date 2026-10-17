import { createAdminClient } from '@/lib/supabase/admin';

export async function bootstrapSystemAdmin() {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const adminName = process.env.INITIAL_ADMIN_NAME || '平台系統總管';

  if (!adminEmail || !adminPassword) {
    return { skipped: true, reason: '未設定 INITIAL_ADMIN_EMAIL 或 INITIAL_ADMIN_PASSWORD 環境變數' };
  }

  try {
    const adminSupabase = createAdminClient();

    // 檢查資料庫是否已存在系統總管
    const { data: existingAdmin, error: queryError } = await adminSupabase
      .from('profiles')
      .select('id, email')
      .eq('role', 'sys_admin')
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error('查詢系統總管狀態時發生錯誤:', queryError.message);
      return { success: false, error: queryError.message };
    }

    if (existingAdmin) {
      return { skipped: true, reason: '系統已存在系統總管帳號，略過初始化' };
    }

    // 建立管理員 Auth 帳號
    const { data: userData, error: createError } = await adminSupabase.auth.admin.createUser({
      email: adminEmail.trim(),
      password: adminPassword.trim(),
      email_confirm: true,
      user_metadata: {
        name: adminName.trim(),
        role: 'sys_admin',
        school_id: null,
      },
    });

    if (createError) {
      console.error('建立初始系統總管帳號失敗:', createError.message);
      return { success: false, error: createError.message };
    }

    if (userData?.user) {
      // 確保 Profile 表記錄同步存在且 role 為 sys_admin
      await adminSupabase.from('profiles').upsert({
        id: userData.user.id,
        school_id: null,
        role: 'sys_admin',
        name: adminName.trim(),
        email: adminEmail.trim(),
      });
    }

    return { success: true, email: adminEmail };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : '系統總管初始化未預期失敗';
    console.error('系統總管初始化失敗:', errorMsg);
    return { success: false, error: errorMsg };
  }
}
