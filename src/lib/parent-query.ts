import { supabase } from '@/lib/supabase';
import type { ParentQueryResult } from '@/types/database';

export async function queryStudentAttendance(
  studentNumber: string,
  parentPhoneLast4: string
): Promise<ParentQueryResult> {
  const cleanStudentNumber = studentNumber.trim();
  const cleanLast4 = parentPhoneLast4.trim();

  if (!cleanStudentNumber || !cleanLast4 || cleanLast4.length !== 4) {
    return { success: false, message: '請輸入正確的學號與家長電話後四碼' };
  }

  // 透過後端 SECURITY DEFINER RPC 進行查核，避免前端暴露個資與家長手機資訊
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('query_student_attendance', {
      p_student_number: cleanStudentNumber,
      p_parent_phone_last4: cleanLast4,
    });

    if (rpcError) {
      console.warn('RPC 查詢失敗:', rpcError.message);
      return { success: false, message: '查詢服務暫時無法連線，請稍候再試' };
    }

    if (rpcData) {
      return rpcData as ParentQueryResult;
    }

    return { success: false, message: '查無符合此學號與電話之在籍學生資料' };
  } catch (err) {
    console.error('查詢過程發生異常:', err);
    return { success: false, message: '系統連線異常，請稍後再試' };
  }
}
