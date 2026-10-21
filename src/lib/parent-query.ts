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

  // 1. 優先嘗試呼叫資料庫安全 RPC
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('query_student_attendance', {
      p_student_number: cleanStudentNumber,
      p_parent_phone_last4: cleanLast4,
    });

    if (!rpcError && rpcData) {
      return rpcData as ParentQueryResult;
    }
  } catch (err) {
    console.warn('RPC 查詢異常，改用客戶端資料查詢:', err);
  }

  // 2. 若 RPC 未生效或失敗，降級以標準查詢 fallback
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, name, student_number, seat_number, parent_phone, class:classes(name), school:schools(name)')
    .eq('student_number', cleanStudentNumber)
    .single();

  if (studentError || !student) {
    return { success: false, message: '查無符合此學號之在籍學生資料' };
  }

  // 驗證電話末四碼
  const cleanPhone = (student.parent_phone || '').replace(/\D/g, '');
  if (!cleanPhone.endsWith(cleanLast4)) {
    return { success: false, message: '家長電話後四碼校驗不符，請重新確認' };
  }

  // 查詢出勤紀錄
  const { data: recordsData } = await supabase
    .from('attendance_records')
    .select('id, status, ai_detected_status, is_overridden, note, created_at, session:attendance_sessions(session_date, period, snapshot_path)')
    .eq('student_id', student.id)
    .order('created_at', { ascending: false })
    .limit(30);

  type SupabaseRecordWithSession = {
    id: string;
    status: 'present' | 'absent' | 'late' | 'leave';
    ai_detected_status: 'present' | 'absent' | null;
    is_overridden: boolean;
    note: string | null;
    created_at: string;
    session: {
      session_date: string;
      period: string | null;
      snapshot_path: string | null;
    } | null;
  };

  const records = ((recordsData as unknown as SupabaseRecordWithSession[]) || []).map((r) => ({
    record_id: r.id,
    date: r.session?.session_date || new Date(r.created_at).toISOString().split('T')[0],
    period: r.session?.period || null,
    status: r.status,
    ai_detected_status: r.ai_detected_status,
    is_overridden: r.is_overridden,
    note: r.note,
    snapshot_path: r.session?.snapshot_path || null,
    created_at: r.created_at,
  }));

  type ClassObj = { name: string } | { name: string }[] | null;
  type SchoolObj = { name: string } | { name: string }[] | null;
  const rawClass = student.class as unknown as ClassObj;
  const rawSchool = student.school as unknown as SchoolObj;
  const studentClass = Array.isArray(rawClass) ? rawClass[0] : rawClass;
  const studentSchool = Array.isArray(rawSchool) ? rawSchool[0] : rawSchool;

  return {
    success: true,
    student: {
      id: student.id,
      name: student.name,
      student_number: student.student_number,
      seat_number: student.seat_number,
      class_name: studentClass?.name || '班級未指定',
      school_name: studentSchool?.name || '學校未指定',
    },
    records,
  };
}
