import { supabase } from '@/lib/supabase';
import type { ParentQueryResult } from '@/types/database';

// The lockout lives in the database (parent_query_attempts); a browser-side counter would be bypassed by a reload

export async function queryStudentAttendance(
  schoolCode: string,
  studentNumber: string,
  parentPhoneLast4: string
): Promise<ParentQueryResult> {
  const cleanSchoolCode = schoolCode.trim();
  const cleanStudentNumber = studentNumber.trim();
  const cleanLast4 = parentPhoneLast4.trim();

  if (!cleanSchoolCode || !cleanStudentNumber || !/^\d{4}$/.test(cleanLast4)) {
    return { success: false, message: '請選擇學校，並輸入學號與家長電話後四碼' };
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

    if (rpcData) return rpcData as ParentQueryResult;

    return { success: false, message: '查無符合此學號與電話之在籍學生資料' };
  } catch (err) {
    console.error('查詢過程發生異常:', err);
    return { success: false, message: '系統連線異常，請稍後再試' };
  }
}
