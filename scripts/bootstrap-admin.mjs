import { createClient } from '@supabase/supabase-js';

// Usage:
//   npm run bootstrap:admin            manual run, exits 1 on failure
//   node scripts/bootstrap-admin.mjs --build
//                                      Vercel build step: skips quietly when not configured
//                                      and never fails the deployment

const isBuild = process.argv.includes('--build');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || args[0] || '').trim();
const adminPassword = (process.env.INITIAL_ADMIN_PASSWORD || args[1] || '').trim();
const adminName = (process.env.INITIAL_ADMIN_NAME || '平台系統總管').trim();

const EXAMPLE_PASSWORD = 'your-secure-admin-password';

/** In build mode a problem must not break the deployment: warn and exit 0 */
function stop(message, code = 1) {
  if (isBuild) {
    console.warn(`[bootstrap-admin] 略過：${message}`);
    process.exit(0);
  }
  console.error(`錯誤: ${message}`);
  process.exit(code);
}

async function main() {
  console.log('=== 班級自動化點名系統：平台系統總管預置 ===');

  // Preview deployments should not touch the production database
  if (isBuild && process.env.VERCEL_ENV === 'preview' && process.env.BOOTSTRAP_ON_PREVIEW !== '1') {
    console.log('[bootstrap-admin] Preview 部署，略過建立系統總管。');
    process.exit(0);
  }

  if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes('placeholder')) {
    stop('尚未設定 VITE_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY。');
  }

  if (!adminEmail || !adminPassword) {
    stop('尚未設定 INITIAL_ADMIN_EMAIL 與 INITIAL_ADMIN_PASSWORD。');
  }

  if (adminPassword.length < 8 || adminPassword === EXAMPLE_PASSWORD) {
    console.warn('警告: INITIAL_ADMIN_PASSWORD 太短或仍是範例值，請改用至少 8 個字元的強密碼。');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. 同信箱帳號已存在：確認為啟用中的系統總管（不重設密碼）
  const { data: existing, error: lookupError } = await supabase
    .from('profiles')
    .select('id, email, role, school_id, is_active, name')
    .eq('email', adminEmail)
    .maybeSingle();

  if (lookupError) {
    stop(`查詢既有帳號失敗：${lookupError.message}`);
  }

  if (existing) {
    const needsUpdate =
      existing.role !== 'sys_admin' || existing.school_id !== null || existing.is_active !== true;

    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'sys_admin', school_id: null, is_active: true })
        .eq('id', existing.id);
      if (updateError) stop(`更新既有帳號失敗：${updateError.message}`);
      console.log(`成功: 已確認 [${adminEmail}] 為啟用中的系統總管。`);
    } else {
      console.log(`提示: 系統總管 [${adminEmail}] 已存在，無需重複初始化。`);
    }
    process.exit(0);
  }

  // 2. 建立 Auth 使用者
  console.log(`正在為 [${adminEmail}] 建立系統總管帳號...`);
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { name: adminName },
  });

  if (createError || !userData?.user) {
    stop(`建立系統總管帳號失敗：${createError?.message ?? '未知原因'}`);
  }

  // 3. 確保 profiles 具備 sys_admin 權限（觸發器可能先建立了 teacher 的 profile）
  const { error: upsertError } = await supabase.from('profiles').upsert({
    id: userData.user.id,
    school_id: null,
    role: 'sys_admin',
    name: adminName,
    email: adminEmail,
    is_active: true,
  });
  if (upsertError) stop(`寫入系統總管個人資料失敗：${upsertError.message}`);

  const { data: verify } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (verify?.role !== 'sys_admin') {
    stop('帳號已建立，但個人資料沒有成為系統總管。請重新執行腳本，或檢查 supabase/schema.sql 是否已套用。');
  }

  console.log('----------------------------------------------------');
  console.log('成功建立平台系統總管！');
  console.log(`登入信箱: ${adminEmail}`);
  console.log('角色身分: 系統總管 (sys_admin)，可永久刪除帳號與資料');
  console.log('----------------------------------------------------');
}

main().catch((err) => {
  stop(`未預期執行錯誤：${err instanceof Error ? err.message : String(err)}`);
});
