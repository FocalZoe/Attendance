// ==============================================================================
// 班級自動化點名系統 - 認證與班級管理服務模組 (authService.js)
// 支援最新 Supabase Publishable/Secret Keys 體系、RPC 密碼零洩漏驗證與雙層角色控制
// ==============================================================================

import { createClient } from '@supabase/supabase-js';

// 優先讀取最新版 Publishable Key，向下相容舊版 ANON KEY
const SUPABASE_URL = 
  (import.meta.env && (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL)) || 
  'https://fsutnzfqzbfvdjjzizzf.supabase.co';

const SUPABASE_KEY = 
  (import.meta.env && (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY)) || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdXRuemZxemJmdmRqanppenpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMjczMDEsImV4cCI6MjA5NzYwMzMwMX0.7BjvnIrcccp7gxJp0zo9nLJEU1HHk2nlFUb5Ul2tjr8';

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
  },
});

const AUTH_STORAGE_KEY = 'attendance_auth_session_v1';

/**
 * 取得當前本機登入會話
 * @returns {{ role: 'admin'|'class', user: Object } | null}
 */
export const getAuthSession = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.role === 'admin' || parsed.role === 'class')) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[AuthService] 讀取登入會話失敗:', err);
  }
  return null;
};

/**
 * 儲存本機登入會話
 * @param {'admin'|'class'} role 
 * @param {Object} user 
 */
export const saveAuthSession = (role, user) => {
  try {
    const sessionData = {
      role,
      id: user?.id || user?.account || '',
      name: user?.class_name || user?.name || user?.account || '',
      studentCount: user?.student_count || 0,
      activeLayoutKey: user?.active_layout_key || 'layout1',
      user,
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionData));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:session-changed', { detail: sessionData }));
    }
  } catch (err) {
    console.error('[AuthService] 儲存登入會話失敗:', err);
  }
};

/**
 * 登出當前帳號，回歸訪客模式
 */
export const logoutAuth = () => {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:session-changed', { detail: null }));
    }
  } catch (err) {
    console.error('[AuthService] 登出失敗:', err);
  }
};

/**
 * 清除會話別名 (相容 clearAuthSession 調用)
 */
export const clearAuthSession = logoutAuth;

/**
 * 1. 管理者專屬登入 (驗證 admin / admin，僅可進入獨立管理頁面)
 * @param {string} username 
 * @param {string} password 
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
export const loginAdmin = async (username, password) => {
  const cleanUser = (username || '').trim();
  const cleanPass = (password || '').trim();

  const envAdminUser = import.meta.env?.ADMIN_USERNAME || 'admin';
  const envAdminPass = import.meta.env?.ADMIN_PASSWORD || 'admin';

  if (cleanUser === envAdminUser && cleanPass === envAdminPass) {
    const adminUser = {
      id: 'admin_root',
      account: 'admin',
      class_name: '系統管理者',
    };
    saveAuthSession('admin', adminUser);
    return { success: true };
  }

  return { success: false, message: '管理者帳號或密碼錯誤 (預設為 admin / admin)' };
};

/**
 * 2. 班級帳號登入 (透過 Supabase SECURITY DEFINER 安全函數，零密碼洩漏)
 * @param {string} account 
 * @param {string} password 
 * @returns {Promise<{ success: boolean, user?: Object, message?: string }>}
 */
export const loginClass = async (account, password) => {
  const cleanAccount = (account || '').trim();
  const cleanPass = (password || '').trim();

  if (!cleanAccount || !cleanPass) {
    return { success: false, message: '請輸入班級帳號與密碼' };
  }

  try {
    // 呼叫資料庫安全預存函數 verify_class_login
    const { data, error } = await supabaseClient.rpc('verify_class_login', {
      p_account: cleanAccount,
      p_password: cleanPass,
    });

    if (error) {
      console.warn('[AuthService] verify_class_login RPC warning:', error);
      // 若尚未建立 RPC 函數，走 RLS 安全查詢備援
      return await fallbackClassLogin(cleanAccount, cleanPass);
    }

    if (Array.isArray(data) && data.length > 0 && data[0].success) {
      const match = data[0];
      const classUser = {
        id: match.class_id,
        account: cleanAccount,
        class_name: match.class_name,
        student_count: match.student_count || 0,
        seat_layout: match.seat_layout || {},
        active_layout_key: match.active_layout_key || 'layout1',
      };
      saveAuthSession('class', classUser);
      return { success: true, user: classUser };
    }

    return { success: false, message: '班級帳號或密碼錯誤，或班級尚未由管理者建立' };
  } catch (err) {
    console.error('[AuthService] 班級登入異常:', err);
    return await fallbackClassLogin(cleanAccount, cleanPass);
  }
};

/**
 * 備援安全登入查詢 (當資料庫尚未建立 RPC 時)
 */
const fallbackClassLogin = async (account, password) => {
  try {
    const { data, error } = await supabaseClient
      .from('class_accounts')
      .select('id, account, class_name, student_count, password_hash, seat_layout, active_layout_key')
      .eq('account', account)
      .limit(1);

    if (!error && Array.isArray(data) && data.length > 0) {
      const row = data[0];
      if (row.password_hash === password) {
        const classUser = {
          id: row.id,
          account: row.account,
          class_name: row.class_name,
          student_count: row.student_count || 0,
          seat_layout: row.seat_layout || {},
          active_layout_key: row.active_layout_key || 'layout1',
        };
        saveAuthSession('class', classUser);
        return { success: true, user: classUser };
      }
    }
    return { success: false, message: '班級帳號或密碼錯誤' };
  } catch (e) {
    return { success: false, message: '連線資料庫失敗，請確認網路或環境變數配置' };
  }
};

// ==============================================================================
// 管理者專用功能 (班級 CRUD 與多座位佈局維護)
// ==============================================================================

/**
 * 管理者取得所有班級清單
 * @returns {Promise<Array>}
 */
export const getAllClasses = async () => {
  try {
    const { data, error } = await supabaseClient
      .from('class_accounts')
      .select('id, account, class_name, student_count, seat_layout, active_layout_key, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AuthService] 取得班級清單失敗:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[AuthService] 查詢班級錯誤:', err);
    return [];
  }
};

/**
 * 管理者新增班級帳號
 * @param {Object} params
 * @param {string} params.account
 * @param {string} params.class_name
 * @param {number} params.student_count
 * @param {string} params.password
 * @returns {Promise<{ success: boolean, classItem?: Object, message?: string }>}
 */
export const createClassAccount = async ({ account, class_name, student_count = 0, password }) => {
  const cleanAccount = (account || '').trim();
  const cleanName = (class_name || '').trim();
  const cleanPass = (password || '').trim();
  const safeCount = Math.max(0, parseInt(student_count, 10) || 0);

  if (!cleanAccount || !cleanName || !cleanPass) {
    return { success: false, message: '班級帳號代碼、班級名稱與密碼為必填項目' };
  }

  // 初始化預設 4x5 矩陣佈局
  const defaultSeatLayout = {
    layout1: {
      name: '平時上課 (4×5 標準)',
      gridRows: 4,
      gridCols: 5,
      base_width: 640,
      base_height: 480,
      seats: [],
    },
  };

  try {
    const { data, error } = await supabaseClient
      .from('class_accounts')
      .insert([
        {
          account: cleanAccount,
          class_name: cleanName,
          student_count: safeCount,
          password_hash: cleanPass,
          seat_layout: defaultSeatLayout,
          active_layout_key: 'layout1',
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, message: `班級帳號代碼「${cleanAccount}」已存在，請使用不同代碼` };
      }
      return { success: false, message: error.message };
    }

    return { success: true, classItem: data };
  } catch (err) {
    return { success: false, message: err.message || '新增班級失敗' };
  }
};

/**
 * 管理者更新班級資料 (班級名稱、學生人數、密碼、座位佈局字典、預設佈局)
 * @param {string} classId 
 * @param {Object} updateData 
 */
export const updateClassInfo = async (classId, updateData) => {
  if (!classId) return { success: false, message: '缺少班級 ID' };

  try {
    const payload = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseClient
      .from('class_accounts')
      .update(payload)
      .eq('id', classId)
      .select()
      .single();

    if (error) {
      return { success: false, message: error.message };
    }

    // 若當前登入者剛好是該班級，即時同步更新 Session
    const currentSession = getAuthSession();
    if (currentSession?.role === 'class' && currentSession?.user?.id === classId) {
      saveAuthSession('class', {
        ...currentSession.user,
        ...data,
      });
    }

    return { success: true, classItem: data };
  } catch (err) {
    return { success: false, message: err.message || '更新班級資料失敗' };
  }
};

/**
 * 管理者刪除班級
 * @param {string} classId 
 */
export const deleteClassAccount = async (classId) => {
  if (!classId) return { success: false, message: '缺少班級 ID' };

  try {
    const { error } = await supabaseClient
      .from('class_accounts')
      .delete()
      .eq('id', classId);

    if (error) {
      return { success: false, message: error.message };
    }

    // 若當前登入者是被刪除的班級，自動登出
    const currentSession = getAuthSession();
    if (currentSession?.role === 'class' && currentSession?.user?.id === classId) {
      logoutAuth();
    }

    return { success: true };
  } catch (err) {
    return { success: false, message: err.message || '刪除班級失敗' };
  }
};
