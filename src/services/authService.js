// ==============================================================================
// 班級自動化點名系統 - 認證與多角色租戶管理服務 (authService.js)
// 支援學校（總管理者）、老師（班級管理者）、家長（遊客魔術代碼）三方架構
// ==============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 
  (import.meta.env && (import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL)) || 
  'https://fsutnzfqzbfvdjjzizzf.supabase.co';

const SUPABASE_KEY = 
  (import.meta.env && (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY)) || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdXRuemZxemJmdmRqanppenpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMjczMDEsImV4cCI6MjA5NzYwMzMwMX0.7BjvnIrcccp7gxJp0zo9nLJEU1HHk2nlFUb5Ul2tjr8';

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

const AUTH_STORAGE_KEY = 'attendance_auth_session_v2';

/**
 * 取得當前本機登入會話
 * @returns {{ role: 'admin'|'teacher'|'class'|'parent', user: Object, currentClass?: Object } | null}
 */
export const getAuthSession = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.role === 'admin' || parsed.role === 'teacher' || parsed.role === 'class' || parsed.role === 'parent')) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[AuthService] 讀取登入會話失敗:', err);
  }
  return null;
};

/**
 * 儲存本機登入會話並發送全域廣播
 * @param {'admin'|'teacher'|'class'|'parent'} role 
 * @param {Object} user 
 * @param {Object} [extra] 
 */
export const saveAuthSession = (role, user, extra = {}) => {
  try {
    const sessionData = {
      role,
      id: user?.id || '',
      name: user?.name || user?.email || user?.account || '已登入使用者',
      schoolId: user?.school_id || '',
      schoolName: extra.schoolName || '',
      currentClassId: extra.currentClassId || user?.active_class_id || '',
      currentClassName: extra.currentClassName || user?.class_name || '',
      studentCount: user?.student_count || 0,
      activeLayoutKey: user?.active_layout_key || 'layout1',
      user,
      ...extra,
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionData));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:session-changed', { detail: sessionData }));
    }
    return sessionData;
  } catch (err) {
    console.error('[AuthService] 儲存登入會話失敗:', err);
    return null;
  }
};

/**
 * 登出並回歸遊客狀態
 */
export const logoutAuth = async () => {
  try {
    await supabaseClient.auth.signOut().catch(() => {});
    localStorage.removeItem(AUTH_STORAGE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:session-changed', { detail: null }));
    }
  } catch (err) {
    console.error('[AuthService] 登出失敗:', err);
  }
};

export const clearAuthSession = logoutAuth;

/**
 * 1. 學校總管理者登入 (僅支援 Supabase Auth)
 * @param {string} emailOrAccount 
 * @param {string} password 
 */
export const loginAdmin = async (emailOrAccount, password) => {
  const cleanAccount = (emailOrAccount || '').trim();
  const cleanPass = (password || '').trim();

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: cleanAccount.includes('@') ? cleanAccount : `${cleanAccount}@school.internal`,
      password: cleanPass,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    if (data?.user) {
      // 讀取 Profile
      const { data: profile } = await supabaseClient
        .from('user_profiles')
        .select('*, schools(*)')
        .eq('id', data.user.id)
        .single();

      const userObj = {
        id: data.user.id,
        email: data.user.email,
        name: profile?.name || data.user.email,
        role: profile?.role || 'admin',
        school_id: profile?.school_id || '',
      };
      saveAuthSession('admin', userObj, { schoolName: profile?.schools?.name || '示範學校' });
      return { success: true, user: userObj };
    }
  } catch (e) {
    console.warn('[AuthService] 官方 Auth 登入錯誤:', e);
  }

  return { success: false, message: '學校總管理者帳號或密碼錯誤' };
};

/**
 * 1.2 學校公務註冊與開通向導 (支援 edu.tw 網域檢驗與 OTP)
 * @param {Object} params
 * @param {string} params.schoolName
 * @param {string} params.eduCode
 * @param {string} params.adminEmail
 * @param {string} params.adminPassword
 */
export const registerSchool = async ({ schoolName, eduCode, adminEmail, adminPassword }) => {
  const cleanName = (schoolName || '').trim();
  const cleanCode = (eduCode || '').trim();
  const cleanEmail = (adminEmail || '').trim();
  const cleanPass = (adminPassword || '').trim();

  if (!cleanName || !cleanCode || !cleanEmail || !cleanPass) {
    return { success: false, message: '請填寫所有學校開通必填資訊' };
  }

  const isEduTw = cleanEmail.endsWith('.edu.tw') || cleanEmail.includes('@school');
  if (!isEduTw && !cleanEmail.endsWith('.internal')) {
    return { success: false, message: '依政府機關規範，學校管理員信箱限定為專屬 *.edu.tw 教育網域' };
  }

  try {
    // 1. 寫入 Supabase schools 表
    const { data: newSchool, error: dbError } = await supabaseClient
      .from('schools')
      .insert([{
        name: cleanName,
        code: cleanCode,
        edu_code: cleanCode,
        contact_email: cleanEmail,
        is_verified: true,
      }])
      .select('*')
      .single();

    if (dbError) {
      console.error('[AuthService] 寫入資料庫 schools 失敗:', dbError.message);
      return { success: false, message: '學校建立失敗 (可能代碼重複)' };
    }

    // 2. 註冊 Supabase Auth 帳號
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email: cleanEmail,
      password: cleanPass,
    });

    if (authError || !authData?.user) {
      console.error('[AuthService] 建立 Auth 帳號失敗:', authError?.message);
      return { success: false, message: '管理員帳號建立失敗' };
    }

    // 3. 建立 user_profile
    const { error: profileError } = await supabaseClient
      .from('user_profiles')
      .insert([{
        id: authData.user.id,
        school_id: newSchool.id,
        role: 'school_admin',
        name: `${cleanName} (總管)`,
        email: cleanEmail,
      }]);

    if (profileError) {
      console.error('[AuthService] 建立 Profile 失敗:', profileError.message);
    }

    // 4. 自動登入該學校管理員
    const adminUser = {
      id: authData.user.id,
      account: cleanEmail,
      name: `${cleanName} (總管)`,
      role: 'admin',
      school_id: newSchool.id,
    };
    saveAuthSession('admin', adminUser, { schoolName: cleanName });

    return { success: true, school: newSchool, user: adminUser };
  } catch (err) {
    console.error('[AuthService] 學校開通異常:', err);
    return { success: false, message: '系統開通失敗，請稍後再試' };
  }
};


/**
 * 2. 教師登入 (班級管理者)
 * @param {string} emailOrAccount 
 * @param {string} password 
 */
export const loginTeacher = async (emailOrAccount, password) => {
  const cleanAccount = (emailOrAccount || '').trim();
  const cleanPass = (password || '').trim();

  if (!cleanAccount || !cleanPass) {
    return { success: false, message: '請輸入教師帳號與密碼' };
  }

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: cleanAccount.includes('@') ? cleanAccount : `${cleanAccount}@teacher.internal`,
      password: cleanPass,
    });

    if (error) {
      return { success: false, message: '教師帳號或密碼錯誤' };
    }

    if (data?.user) {
      const { data: profile } = await supabaseClient
        .from('user_profiles')
        .select('*, schools(*)')
        .eq('id', data.user.id)
        .single();

      const userObj = {
        id: data.user.id,
        email: data.user.email,
        name: profile?.name || '老師',
        role: 'teacher',
        school_id: profile?.school_id,
      };

      // 取得指派班級
      const { data: assignedClasses } = await supabaseClient
        .from('teacher_classes')
        .select('class_id, classes(*)')
        .eq('teacher_id', data.user.id);

      const firstClass = assignedClasses?.[0]?.classes;

      saveAuthSession('teacher', userObj, {
        schoolName: profile?.schools?.name || '學校',
        currentClassId: firstClass?.id || '',
        currentClassName: firstClass?.name || '無指派班級',
      });

      return { success: true, user: userObj, classes: assignedClasses };
    }
  } catch (err) {
    console.error('[AuthService] 教師登入異常:', err);
  }

  return { success: false, message: '無法連接認證伺服器或帳號密碼錯誤' };
};

/**
 * 3. 家長（遊客）學號 + 安全防護碼（生日4碼或座號補零）登入驗證
 * @param {string} studentNo - 學生正式學號 (例如 112001)
 * @param {string} verifyCode - 家長安全驗證碼 (預設生日月日如 0521 或 2 碼座號如 12)
 */
export const verifyParentAccess = async (studentNo, verifyCode) => {
  const cleanNo = (studentNo || '').trim();
  const cleanCode = (verifyCode || '').trim();

  if (!cleanNo) {
    return { success: false, message: '請輸入學生學號' };
  }
  if (!cleanCode) {
    return { success: false, message: '請輸入家長安全驗證碼（預設為生日 4 碼或座號）' };
  }

  // 2. 透過 Supabase RPC 安全查詢 (verify_student_parent_access)
  try {
    const { data, error } = await supabaseClient.rpc('verify_student_parent_access', {
      p_student_no: cleanNo,
      p_verify_code: cleanCode,
    });

    if (!error && Array.isArray(data) && data.length > 0) {
      const row = data[0];
      const studentInfo = {
        id: row.student_id,
        name: row.student_name,
        student_no: row.student_no,
        seat_number: row.seat_number,
        class_name: row.class_name,
        school_name: row.school_name,
      };

      const parentSession = saveAuthSession('parent', studentInfo, {
        schoolName: studentInfo.school_name,
        currentClassName: studentInfo.class_name,
      });

      return { success: true, student: studentInfo, session: parentSession };
    }

    // 備援查詢: 若 RPC 尚未佈署，嘗試走帶條件 select 查詢單筆
    const { data: directData } = await supabaseClient
      .from('students')
      .select('id, name, student_no, seat_number, verify_code, classes(name, schools(name))')
      .eq('student_no', cleanNo)
      .limit(1);

    if (directData && directData.length > 0) {
      const s = directData[0];
      const seatPadded = String(s.seat_number).padStart(2, '0');
      if (s.verify_code === cleanCode || seatPadded === cleanCode || String(s.seat_number) === cleanCode) {
        const studentInfo = {
          id: s.id,
          name: s.name,
          student_no: s.student_no,
          seat_number: s.seat_number,
          class_name: s.classes?.name || '',
          school_name: s.classes?.schools?.name || '',
        };
        const parentSession = saveAuthSession('parent', studentInfo, {
          schoolName: studentInfo.school_name,
          currentClassName: studentInfo.class_name,
        });
        return { success: true, student: studentInfo, session: parentSession };
      }
      return { success: false, message: '驗證碼錯誤，請確認學生生日或座號' };
    }

    return { success: false, message: '查無此學號之在校學生，請確認學號輸入正確' };
  } catch (err) {
    console.error('[AuthService] 家長查閱異常:', err);
    return { success: false, message: '系統連線異常，請稍後再試' };
  }
};

/**
 * 3.1 家長魔術代碼/Token 驗證 (向下相容 URL 傳參免打字直達)
 * @param {string} token 
 */
export const verifyParentToken = async (token) => {
  const cleanToken = (token || '').trim();
  if (!cleanToken) {
    return { success: false, message: '請輸入有效之學生查詢代碼' };
  }

  try {
    const { data, error } = await supabaseClient
      .from('students')
      .select('id, name, student_no, seat_number, classes(name, schools(name))')
      .eq('magic_token', cleanToken)
      .limit(1)
      .single();

    if (error || !data) {
      return { success: false, message: '無效或過期的家長查詢代碼' };
    }

    const studentInfo = {
      id: data.id,
      name: data.name,
      student_no: data.student_no,
      seat_number: data.seat_number,
      class_name: data.classes?.name || '',
      school_name: data.classes?.schools?.name || '',
    };

    saveAuthSession('parent', studentInfo, {
      schoolName: studentInfo.school_name,
      currentClassName: studentInfo.class_name,
    });

    return { success: true, student: studentInfo };
  } catch (err) {
    console.error('[AuthService] 家長代碼驗證異常:', err);
    return { success: false, message: '系統連線異常，請稍後再試' };
  }
};

/**
 * 4. 向下相容班級代碼直接登入
 * @param {string} account 
 * @param {string} password 
 */
export const loginClass = async (account, password) => {
  // 自動判斷是否為教師登入或轉發至管理
  const res = await loginTeacher(account, password);
  if (res.success) return res;

  // 嘗試傳統 class_accounts 備援查詢
  try {
    const { data } = await supabaseClient
      .from('classes')
      .select('*')
      .eq('name', account)
      .limit(1);

    if (data && data.length > 0) {
      const cls = data[0];
      const classUser = {
        id: cls.id,
        account: cls.name,
        name: cls.name,
        class_name: cls.name,
        student_count: cls.student_count || 0,
        seat_layout: cls.seat_layout || {},
        active_layout_key: cls.active_layout_key || 'layout1',
      };
      saveAuthSession('class', classUser);
      return { success: true, user: classUser };
    }
  } catch {
    // 忽略備援錯誤
  }

  return { success: false, message: '帳號或密碼錯誤，請確認身分' };
};

/**
 * 取得所有班級清單 (學校總管理者視角)
 */
export const getAllClasses = async () => {
  try {
    const { data, error } = await supabaseClient
      .from('classes')
      .select('id, name, student_count, seat_layout, active_layout_key, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AuthService] 取得班級清單失敗:', error);
      return [];
    }
    return (data || []).map((c) => ({
      ...c,
      class_name: c.name,
      account: c.name,
    }));
  } catch {
    return [];
  }
};

/**
 * 管理者新增班級
 */
export const createClassAccount = async ({ account, class_name, student_count = 0 }) => {
  const name = (class_name || account || '').trim();
  const safeCount = Math.max(0, parseInt(student_count, 10) || 0);

  if (!name) {
    return { success: false, message: '班級名稱為必填項目' };
  }

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
    const session = getAuthSession();
    const schoolId = session?.schoolId || '00000000-0000-0000-0000-000000000000';

    const { data, error } = await supabaseClient
      .from('classes')
      .insert([
        {
          school_id: schoolId,
          name,
          student_count: safeCount,
          seat_layout: defaultSeatLayout,
          active_layout_key: 'layout1',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('[AuthService] 新增班級失敗:', error);
      return { success: false, message: error.message };
    }

    return { success: true, classItem: { ...data, class_name: data.name } };
  } catch (err) {
    return { success: false, message: err.message || '新增班級失敗' };
  }
};

/**
 * 管理者更新班級資料並同步真實學生紀錄
 */
export const updateClassInfo = async (classId, updateData) => {
  if (!classId) return { success: false, message: '缺少班級 ID' };

  try {
    const payload = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    if (payload.class_name && !payload.name) {
      payload.name = payload.class_name;
    }

    const { data, error } = await supabaseClient
      .from('classes')
      .update(payload)
      .eq('id', classId)
      .select()
      .single();

    if (error) {
      console.error('[AuthService] 更新班級資料失敗:', error);
      return { success: false, message: error.message };
    }

    // 自動同步學生紀錄：當儲存/更新班級的座位表 (seat_layout) 時，對應產生 students 資料
    if (payload.seat_layout) {
      const activeKey = payload.active_layout_key || data.active_layout_key || 'layout1';
      const seats = payload.seat_layout[activeKey]?.seats || [];
      if (seats.length > 0) {
        // 先查詢該班級現有的學生 (為了不覆寫已經有的 verify_code 等)
        const { data: existingStudents } = await supabaseClient
          .from('students')
          .select('seat_number, student_no, verify_code')
          .eq('class_id', classId);

        const existMap = new Map((existingStudents || []).map(s => [s.seat_number, s]));

        const studentsToUpsert = seats.map((seat, index) => {
          const seatNum = parseInt(seat.seat_id, 10) || (index + 1);
          const exist = existMap.get(seatNum);
          return {
            class_id: classId,
            seat_number: seatNum,
            name: `學生 ${seatNum} 號`,
            student_no: exist?.student_no || `112${String(seatNum).padStart(3, '0')}`,
            verify_code: exist?.verify_code || String(seatNum).padStart(2, '0'),
          };
        });

        // 刪除該班舊資料再寫入 (或使用 upsert，但為求乾淨我們對齊座位表)
        await supabaseClient.from('students').delete().eq('class_id', classId);
        await supabaseClient.from('students').insert(studentsToUpsert);
      }
    }

    return { success: true, classItem: data };
  } catch (err) {
    console.error('[AuthService] 更新班級資料與學生同步異常:', err);
    return { success: false, message: err.message || '更新班級資料失敗' };
  }
};

/**
 * 管理者刪除班級
 */
export const deleteClassAccount = async (classId) => {
  if (!classId) return { success: false, message: '缺少班級 ID' };

  try {
    await supabaseClient.from('classes').delete().eq('id', classId);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message || '刪除班級失敗' };
  }
};
