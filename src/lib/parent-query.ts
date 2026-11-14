import { supabase } from '@/lib/supabase';
import type { ParentQueryResult } from '@/types/database';

// Client-side throttle only softens casual guessing; the real lockout lives in the RPC (parent_query_attempts)
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;
let failedAttempts = 0;
let lockedUntil = 0;

export async function queryStudentAttendance(
  schoolCode: string,
  studentNumber: string,
  parentPhoneLast4: string
): Promise<ParentQueryResult> {
  const cleanSchoolCode = schoolCode.trim();
  const cleanStudentNumber = studentNumber.trim();
  const cleanLast4 = parentPhoneLast4.trim();

  if (!cleanSchoolCode || !cleanStudentNumber || !/^\d{4}$/.test(cleanLast4)) {
    return { success: false, message: '請輸入學校代碼、學號與家長電話後四碼' };
  }

  const now = Date.now();
  if (now < lockedUntil) {
    const secs = Math.ceil((lockedUntil - now) / 1000);
    return { success: false, message: `嘗試次數過多，請於 ${secs} 秒後再試` };
  }

  // 透過後端 SECURITY DEFINER RPC 進行查核，避免前端暴露個資與家長手機資訊
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('query_student_attendance', {
      p_school_code: cleanSchoolCode,
      p_student_number: cleanStudentNumber,
      p_parent_phone_last4: cleanLast4,
    });

    if (rpcError) {
      console.warn('RPC 查詢失敗:', rpcError.message);
      return { success: false, message: '查詢服務暫時無法連線，請稍候再試' };
    }

    if (rpcData) {
      const result = rpcData as ParentQueryResult;
      if (result.success) {
        failedAttempts = 0;
      } else if (++failedAttempts >= MAX_FAILED_ATTEMPTS) {
        failedAttempts = 0;
        lockedUntil = Date.now() + LOCKOUT_MS;
      }
      return result;
    }

    if (++failedAttempts >= MAX_FAILED_ATTEMPTS) {
      failedAttempts = 0;
      lockedUntil = Date.now() + LOCKOUT_MS;
    }
    return { success: false, message: '查無符合此學號與電話之在籍學生資料' };
  } catch (err) {
    console.error('查詢過程發生異常:', err);
    return { success: false, message: '系統連線異常，請稍後再試' };
  }
}
