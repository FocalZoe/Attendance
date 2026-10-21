import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.INITIAL_ADMIN_EMAIL || process.argv[2];
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || process.argv[3];
const adminName = process.env.INITIAL_ADMIN_NAME || '平台系統總管';

async function main() {
  console.log('=== 班級自動化點名系統：系統總管安全預置工具 ===');

  if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes('placeholder')) {
    console.error('錯誤: 請先在 .env.local 中配置正確的 NEXT_PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY。');
    process.exit(1);
  }

  if (!adminEmail || !adminPassword) {
    console.error('錯誤: 請於 .env.local 設定 INITIAL_ADMIN_EMAIL 與 INITIAL_ADMIN_PASSWORD，或以參數帶入：');
    console.error('指令範例: node --env-file=.env.local scripts/bootstrap-admin.mjs admin@example.com mySecurePass123');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. 檢查是否已存在同 Email 或同角色之管理員
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('email', adminEmail.trim())
    .maybeSingle();

  if (existingProfile) {
    if (existingProfile.role === 'sys_admin') {
      console.log(`提示: 系統總管帳號 [${adminEmail}] 已存在，無需重複初始化。`);
      console.log('您可以直接前往 /login 輸入此帳號密碼登入。');
      process.exit(0);
    } else {
      // 更新權限為 sys_admin
      await supabase
        .from('profiles')
        .update({ role: 'sys_admin', school_id: null })
        .eq('id', existingProfile.id);
      console.log(`成功: 已將既有帳號 [${adminEmail}] 提升為系統總管權限 (sys_admin)。`);
      process.exit(0);
    }
  }

  // 2. 建立 Auth 使用者
  console.log(`正在為 [${adminEmail}] 建立系統總管帳號...`);
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
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
    console.error('建立系統總管帳號失敗:', createError.message);
    process.exit(1);
  }

  // 3. 確保 Profile 表記錄具備 sys_admin 權限
  if (userData?.user) {
    await supabase.from('profiles').upsert({
      id: userData.user.id,
      school_id: null,
      role: 'sys_admin',
      name: adminName.trim(),
      email: adminEmail.trim(),
    });
  }

  console.log('----------------------------------------------------');
  console.log('成功建立系統總管帳號！');
  console.log(`登入信箱: ${adminEmail}`);
  console.log('角色身分: 系統總管 (sys_admin)');
  console.log('請前往 http://localhost:3000/login 進行登入。');
  console.log('系統驗證成功後將自動導向至 /dashboard/sys-admin。');
  console.log('----------------------------------------------------');
}

main().catch((err) => {
  console.error('未預期執行錯誤:', err);
  process.exit(1);
});
