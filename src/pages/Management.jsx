// ==============================================================================
// 班級自動化考勤系統 - 綜合管理中樞 (Management.jsx)
// 支援學校總管 (Admin)、班導師 (Homeroom)、科系導師 (Subject) 三級權限邊界
// 米白咖啡色系 (Warm Cream & Rich Coffee)，純淨典雅
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  School, Plus, Edit2, Trash2, Save, ShieldCheck, Check, 
  LayoutGrid, Users, Key, AlertCircle, ArrowLeft, RefreshCw, 
  Settings, CheckCircle, ExternalLink, LogOut, Lock, User, 
  GraduationCap, UserCheck, ShieldAlert, Award
} from 'lucide-react';
import { 
  getAuthSession, getAllClasses, createClassAccount, 
  updateClassInfo, deleteClassAccount, clearAuthSession,
  getStudentsByClass, createStudent, updateStudent, deleteStudent,
  getAllTeachers, createTeacherAccount, deleteTeacherAccount, updateTeacherAssignment
} from '../services/authService';
import { generateGridSeats } from '../services/seatOccupancyService';
import SeatMapEditorModal from '../components/SeatMapEditorModal';
import Toast from '../components/Toast';

export const Management = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState(getAuthSession());
  const [mainTab, setMainTab] = useState('classes'); // 'classes' | 'students' | 'teachers'

  // 班級與佈局狀態
  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState(null);

  // 學生名冊狀態
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentSeat, setNewStudentSeat] = useState('');
  const [newStudentNo, setNewStudentNo] = useState('');
  const [newStudentCode, setNewStudentCode] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);

  // 教師名冊狀態 (僅 Admin)
  const [teachers, setTeachers] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherPassword, setNewTeacherPassword] = useState('123456');
  const [newTeacherClassId, setNewTeacherClassId] = useState('');
  const [newTeacherIsHomeroom, setNewTeacherIsHomeroom] = useState(false);

  // 新增班級表單 Modal (僅 Admin)
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [newAccount, setNewAccount] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [newStudentCount, setNewStudentCount] = useState(38);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // 編輯劃位 Modal 狀態
  const [editingLayoutKey, setEditingLayoutKey] = useState(null);
  const [isSeatEditorOpen, setIsSeatEditorOpen] = useState(false);

  // 新增佈局表單狀態
  const [isAddLayoutOpen, setIsAddLayoutOpen] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('新座位佈局');
  const [newLayoutRows, setNewLayoutRows] = useState(4);
  const [newLayoutCols, setNewLayoutCols] = useState(5);

  const isAdmin = session?.role === 'admin';
  const isTeacher = session?.role === 'teacher' || session?.role === 'class';
  
  // 判斷在目前選取的班級中，當前使用者是否為班導師
  const isHomeroomForCurrentClass = () => {
    if (isAdmin) return true;
    if (!isTeacher) return false;
    if (session?.isHomeroom) return true;
    const assigned = session?.assignedClasses || [];
    const match = assigned.find((a) => a.id === selectedClassId || a.class_id === selectedClassId);
    return !!match?.is_homeroom;
  };

  const isCurrentClassHomeroom = isHomeroomForCurrentClass();

  // 動態更新網頁標題
  useEffect(() => {
    document.title = '綜合管理中樞 - 班級自動化考勤系統';
    return () => {
      document.title = '班級自動化考勤系統';
    };
  }, []);

  // 1. 載入班級列表 (依據 Admin 或 Teacher 權限載入不同範圍)
  const loadClasses = async () => {
    setLoadingClasses(true);
    try {
      if (isAdmin) {
        const list = await getAllClasses();
        setClasses(list);
        if (list.length > 0 && !selectedClassId) {
          setSelectedClassId(list[0].id);
        }
      } else if (isTeacher) {
        // 教師限定存取指派班級
        const assigned = session?.assignedClasses || [];
        if (assigned.length > 0) {
          const formatted = assigned.map((c) => ({
            id: c.id || c.class_id,
            name: c.class_name || c.name,
            class_name: c.class_name || c.name,
            account: c.account || c.class_name,
            student_count: c.student_count || 0,
            seat_layout: c.seat_layout || {},
            active_layout_key: c.active_layout_key || 'layout1',
          }));
          setClasses(formatted);
          if (!selectedClassId) {
            setSelectedClassId(formatted[0].id);
          }
        } else {
          // 若無指派班級資料，嘗試以當前 session class 作為 fallback
          if (session?.currentClassId) {
            setClasses([{
              id: session.currentClassId,
              name: session.currentClassName || '我的班級',
              class_name: session.currentClassName || '我的班級',
              account: session.currentClassName || 'teacher',
              student_count: session.studentCount || 0,
              seat_layout: session.user?.seat_layout || {},
              active_layout_key: session.activeLayoutKey || 'layout1',
            }]);
            setSelectedClassId(session.currentClassId);
          }
        }
      }
    } catch (err) {
      console.error('[Management] 載入班級清單失敗:', err);
    } finally {
      setLoadingClasses(false);
    }
  };

  // 2. 載入當前班級的學生清單
  const loadStudents = async (classId) => {
    if (!classId) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    try {
      const data = await getStudentsByClass(classId);
      setStudents(data);
    } catch (err) {
      console.error('[Management] 載入學生清單失敗:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  // 3. 載入全校教師清單 (僅 Admin)
  const loadTeachers = async () => {
    if (!isAdmin) return;
    setLoadingTeachers(true);
    try {
      const list = await getAllTeachers(session?.schoolId);
      setTeachers(list);
    } catch (err) {
      console.error('[Management] 載入教師失敗:', err);
    } finally {
      setLoadingTeachers(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, [isAdmin]);

  useEffect(() => {
    if (selectedClassId) {
      loadStudents(selectedClassId);
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (isAdmin && mainTab === 'teachers') {
      loadTeachers();
    }
  }, [isAdmin, mainTab]);

  // 當前選中的班級物件
  const currentClass = classes.find((c) => c.id === selectedClassId) || null;

  // 登出處理
  const handleLogout = () => {
    clearAuthSession();
    navigate('/login');
  };

  // ==========================================
  // 班級基本維護操作
  // ==========================================

  // 新增班級 (僅 Admin)
  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    setActionError('');
    setActionSuccess('');

    const res = await createClassAccount({
      account: newAccount,
      class_name: newClassName,
      student_count: newStudentCount,
    });

    if (res.success) {
      setIsAddClassModalOpen(false);
      setNewAccount('');
      setNewClassName('');
      setNewStudentCount(38);
      setActionSuccess('班級建立成功！');
      await loadClasses();
      if (res.classItem?.id) {
        setSelectedClassId(res.classItem.id);
      }
      setTimeout(() => setActionSuccess(''), 3000);
    } else {
      setActionError(res.message || '建立班級失敗');
    }
  };

  // 更新班級基本資料 (Admin 或 班導師)
  const handleUpdateClass = async (e) => {
    e.preventDefault();
    if (!currentClass) return;
    if (!isAdmin && !isCurrentClassHomeroom) {
      setActionError('僅學校總管或該班班導師可修改班級基本資訊');
      return;
    }
    setActionError('');
    setActionSuccess('');

    const res = await updateClassInfo(currentClass.id, {
      class_name: currentClass.class_name,
      student_count: currentClass.student_count,
    });

    if (res.success) {
      setActionSuccess('班級基本資料更新成功！');
      await loadClasses();
      setTimeout(() => setActionSuccess(''), 3000);
    } else {
      setActionError(res.message || '更新失敗');
    }
  };

  // 刪除班級 (僅 Admin)
  const handleDeleteClass = async (classId, className) => {
    if (!isAdmin) return;
    if (!window.confirm(`確定要刪除班級「${className}」嗎？此操作無法還原。`)) return;
    const res = await deleteClassAccount(classId);
    if (res.success) {
      setActionSuccess('班級已刪除');
      await loadClasses();
      setSelectedClassId(null);
      setTimeout(() => setActionSuccess(''), 3000);
    } else {
      setActionError(res.message || '刪除失敗');
    }
  };

  // ==========================================
  // 座位劃位佈局操作
  // ==========================================

  // 新增座位佈局 (Admin、班導師、科系導師皆可)
  const handleAddLayout = async (e) => {
    e.preventDefault();
    if (!currentClass) return;

    const currentLayouts = { ...(currentClass.seat_layout || {}) };
    const nextKey = `layout_${Date.now()}`;
    const generatedSeats = generateGridSeats(newLayoutRows, newLayoutCols, 640, 480);

    // 寫入建立者 ID 與建立者姓名以支援細緻權限控管
    currentLayouts[nextKey] = {
      name: newLayoutName || `座位佈局 ${Object.keys(currentLayouts).length + 1}`,
      base_width: 640,
      base_height: 480,
      gridRows: newLayoutRows,
      gridCols: newLayoutCols,
      seats: generatedSeats,
      created_by: session?.id || 'admin',
      created_by_name: session?.name || '管理員',
      created_at: new Date().toISOString(),
    };

    const res = await updateClassInfo(currentClass.id, {
      seat_layout: currentLayouts,
      active_layout_key: nextKey,
    });

    if (res.success) {
      setIsAddLayoutOpen(false);
      setNewLayoutName('新座位佈局');
      await loadClasses();
      setActionSuccess('新增座位佈局成功！');
      setTimeout(() => setActionSuccess(''), 3000);
    }
  };

  // 刪除座位佈局 (Admin、班導師，或該劃位的建立者科系導師)
  const handleDeleteLayout = async (layoutKey, layoutData) => {
    if (!currentClass) return;
    const currentLayouts = { ...(currentClass.seat_layout || {}) };
    if (Object.keys(currentLayouts).length <= 1) {
      alert('至少必須保留一組座位佈局！');
      return;
    }

    // 權限檢查：非 Admin 且非班導師時，必須是自己建立的佈局才可刪除
    if (!isAdmin && !isCurrentClassHomeroom && layoutData?.created_by !== session?.id) {
      alert('科系導師僅能刪除由自己新增的座位佈局！');
      return;
    }

    if (!window.confirm(`確定要刪除座位佈局「${layoutData.name || layoutKey}」嗎？`)) return;

    delete currentLayouts[layoutKey];
    let nextActive = currentClass.active_layout_key;
    if (nextActive === layoutKey) {
      nextActive = Object.keys(currentLayouts)[0];
    }

    const res = await updateClassInfo(currentClass.id, {
      seat_layout: currentLayouts,
      active_layout_key: nextActive,
    });

    if (res.success) {
      await loadClasses();
      setActionSuccess('座位佈局已刪除');
      setTimeout(() => setActionSuccess(''), 3000);
    }
  };

  // 開啟劃位編輯器 (權限校驗)
  const handleOpenEditor = (layoutKey, layoutData) => {
    // 若不是 Admin 且不是班導師，則必須是自己建立的才能編輯劃位
    if (!isAdmin && !isCurrentClassHomeroom && layoutData?.created_by && layoutData.created_by !== session?.id) {
      alert('科系導師僅能修改由自己新增的班級劃位。其他劃位僅提供點名使用與檢視。');
      return;
    }
    setEditingLayoutKey(layoutKey);
    setIsSeatEditorOpen(true);
  };

  // 劃位儲存成功回呼
  const handleEditorSaveSuccess = async () => {
    await loadClasses();
    setIsSeatEditorOpen(false);
    setActionSuccess('座位劃位配置已成功儲存！');
    setTimeout(() => setActionSuccess(''), 3000);
  };

  // 切換為預設啟用佈局 (Active Layout)
  const handleSetActiveLayout = async (layoutKey) => {
    if (!currentClass) return;
    const res = await updateClassInfo(currentClass.id, {
      active_layout_key: layoutKey,
    });
    if (res.success) {
      await loadClasses();
      setActionSuccess('已切換當前課堂使用中之座位佈局');
      setTimeout(() => setActionSuccess(''), 2500);
    }
  };

  // ==========================================
  // 學生名冊管理操作 (Admin 與 班導師)
  // ==========================================

  // 新增學生
  const handleCreateStudent = async (e) => {
    e.preventDefault();
    if (!currentClass || (!isAdmin && !isCurrentClassHomeroom)) {
      setActionError('權限不足：僅學校總管或班導師可新增學生');
      return;
    }

    const res = await createStudent({
      class_id: currentClass.id,
      name: newStudentName,
      seat_number: newStudentSeat,
      student_no: newStudentNo,
      verify_code: newStudentCode,
    });

    if (res.success) {
      setIsAddStudentOpen(false);
      setNewStudentName('');
      setNewStudentSeat('');
      setNewStudentNo('');
      setNewStudentCode('');
      setActionSuccess('學生新增成功！');
      loadStudents(currentClass.id);
      setTimeout(() => setActionSuccess(''), 3000);
    } else {
      setActionError(res.message || '新增學生失敗');
    }
  };

  // 更新學生
  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent || (!isAdmin && !isCurrentClassHomeroom)) return;

    const res = await updateStudent(editingStudent.id, {
      name: editingStudent.name,
      seat_number: editingStudent.seat_number,
      student_no: editingStudent.student_no,
      verify_code: editingStudent.verify_code,
    });

    if (res.success) {
      setEditingStudent(null);
      setActionSuccess('學生資料已更新！');
      loadStudents(currentClass.id);
      setTimeout(() => setActionSuccess(''), 3000);
    } else {
      setActionError(res.message || '更新學生資料失敗');
    }
  };

  // 刪除學生
  const handleDeleteStudent = async (studentId, studentName) => {
    if (!isAdmin && !isCurrentClassHomeroom) {
      alert('權限不足：僅學校總管或班導師可刪除學生');
      return;
    }
    if (!window.confirm(`確定要刪除學生「${studentName}」嗎？`)) return;

    const res = await deleteStudent(studentId);
    if (res.success) {
      setActionSuccess('學生已刪除');
      loadStudents(currentClass.id);
      setTimeout(() => setActionSuccess(''), 3000);
    } else {
      setActionError(res.message || '刪除學生失敗');
    }
  };

  // ==========================================
  // 教師帳號管理操作 (僅 Admin)
  // ==========================================

  // 新增教師
  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    const res = await createTeacherAccount({
      name: newTeacherName,
      email: newTeacherEmail,
      password: newTeacherPassword,
      schoolId: session?.schoolId,
      isHomeroom: newTeacherIsHomeroom,
      classId: newTeacherClassId || null,
    });

    if (res.success) {
      setIsAddTeacherOpen(false);
      setNewTeacherName('');
      setNewTeacherEmail('');
      setNewTeacherPassword('123456');
      setNewTeacherClassId('');
      setNewTeacherIsHomeroom(false);
      setActionSuccess('教師帳號建立成功！');
      loadTeachers();
      setTimeout(() => setActionSuccess(''), 3000);
    } else {
      setActionError(res.message || '建立教師失敗');
    }
  };

  // 刪除教師
  const handleDeleteTeacher = async (teacherId, teacherName) => {
    if (!isAdmin) return;
    if (!window.confirm(`確定要刪除教師「${teacherName}」嗎？此操作將解除所有班級指派。`)) return;

    const res = await deleteTeacherAccount(teacherId);
    if (res.success) {
      setActionSuccess('教師帳號已刪除');
      loadTeachers();
      setTimeout(() => setActionSuccess(''), 3000);
    } else {
      setActionError(res.message || '刪除教師失敗');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'var(--bg-color)',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
    }}>
      {/* 獨立後台頂部 Navigation Bar */}
      <header style={{
        height: '64px',
        background: '#ffffff',
        borderBottom: '1px solid var(--border-color)',
        padding: '0 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {/* 左側 Logo 與標題 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
          }}>
            <School size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              班級自動化考勤系統
              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--accent-light)', color: 'var(--accent-primary)', border: '1px solid var(--border-color)', fontWeight: 600 }}>
                {isAdmin ? '全校管理中樞' : (isCurrentClassHomeroom ? '班導師工作台' : '教師工作台')}
              </span>
            </div>
          </div>
        </div>

        {/* 右側操作：身分資訊、返回前台、登出 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'var(--accent-light)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            {isAdmin ? <ShieldCheck size={16} color="var(--accent-primary)" /> : <User size={16} color="var(--accent-primary)" />}
            <span>
              身分：<strong style={{ color: 'var(--accent-primary)' }}>
                {isAdmin ? '學校總管' : (isCurrentClassHomeroom ? `${session?.name} (班導師)` : `${session?.name} (任課/科系導師)`)}
              </strong>
            </span>
          </div>

          {isTeacher && (
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '6px',
                background: '#ffffff',
                border: '1px solid var(--border-dark)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ExternalLink size={14} />
              進入即時考勤儀表板
            </button>
          )}

          <button
            onClick={() => navigate('/history')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '6px',
              background: '#ffffff',
              border: '1px solid var(--border-dark)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <ExternalLink size={14} />
            查看考勤紀錄簿
          </button>

          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '6px',
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <LogOut size={14} />
            登出
          </button>
        </div>
      </header>

      {/* 獨立後台內容區 */}
      <main style={{ flex: 1, padding: '28px', maxWidth: '1440px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {/* Toast 通知 */}
        {actionSuccess && (
          <Toast message={actionSuccess} type="success" onClose={() => setActionSuccess('')} />
        )}
        {actionError && (
          <Toast message={actionError} type="error" onClose={() => setActionError('')} />
        )}

        {/* 頂部三合一功能 Tab 切換 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <button
            onClick={() => setMainTab('classes')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 18px', borderRadius: '6px', border: 'none',
              background: mainTab === 'classes' ? 'var(--accent-primary)' : 'transparent',
              color: mainTab === 'classes' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: mainTab === 'classes' ? 700 : 500, fontSize: '0.92rem', cursor: 'pointer',
            }}
          >
            <LayoutGrid size={16} />
            班級與座位空間
          </button>

          <button
            onClick={() => setMainTab('students')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 18px', borderRadius: '6px', border: 'none',
              background: mainTab === 'students' ? 'var(--accent-primary)' : 'transparent',
              color: mainTab === 'students' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: mainTab === 'students' ? 700 : 500, fontSize: '0.92rem', cursor: 'pointer',
            }}
          >
            <Users size={16} />
            學生名冊與身分維護
          </button>

          {isAdmin && (
            <button
              onClick={() => setMainTab('teachers')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 18px', borderRadius: '6px', border: 'none',
                background: mainTab === 'teachers' ? 'var(--accent-primary)' : 'transparent',
                color: mainTab === 'teachers' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: mainTab === 'teachers' ? 700 : 500, fontSize: '0.92rem', cursor: 'pointer',
              }}
            >
              <ShieldCheck size={16} />
              全校教師帳號與指派 (總管限定)
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 分頁 1: 班級與座位空間管理 */}
        {/* ========================================================================= */}
        {mainTab === 'classes' && (
          <div>
            {/* 標題與新增按鈕 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  班級與劃位空間管理
                </h1>
                <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0', fontSize: '0.88rem' }}>
                  {isAdmin 
                    ? '管理全校各班級帳號、劃設專屬的多組命名座位佈局，並指派導師權限' 
                    : (isCurrentClassHomeroom ? '您為本班導師，可自由維護班級人數與所有座位佈局' : '您為科系/任課導師，可新增自己的座位佈局或修改由您新增之佈局')}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={loadClasses}
                  disabled={loadingClasses}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: '#ffffff', color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)', padding: '8px 14px',
                    borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={14} className={loadingClasses ? 'animate-spin' : ''} /> 重新整理名冊
                </button>

                {isAdmin && (
                  <button
                    onClick={() => setIsAddClassModalOpen(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: 'var(--accent-primary)', color: '#ffffff',
                      border: 'none', padding: '8px 18px',
                      borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <Plus size={16} /> 新增班級
                  </button>
                )}
              </div>
            </div>

            {/* 班級列表 (左側) + 詳情與多佈局 (右側) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '24px', alignItems: 'start' }}>
              {/* 左側：班級列表 */}
              <div style={{
                background: '#ffffff',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {isAdmin ? `全校班級清單 (${classes.length})` : `我的指派班級 (${classes.length})`}
                </h2>

                {loadingClasses ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                    載入班級中...
                  </div>
                ) : classes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 10px', color: 'var(--text-secondary)' }}>
                    <School size={36} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>目前尚未建立或指派任何班級</p>
                    {isAdmin && (
                      <button
                        onClick={() => setIsAddClassModalOpen(true)}
                        style={{
                          marginTop: '12px',
                          padding: '6px 14px',
                          background: 'var(--accent-primary)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        立即建立第一個班級
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {classes.map((cls) => {
                      const isSelected = cls.id === selectedClassId;
                      const layoutCount = cls.seat_layout ? Object.keys(cls.seat_layout).length : 0;
                      return (
                        <div
                          key={cls.id}
                          onClick={() => setSelectedClassId(cls.id)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '8px',
                            border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                            background: isSelected ? 'var(--accent-light)' : '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                              {cls.class_name || cls.name}
                            </span>
                            <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: isSelected ? '#e8dfd5' : 'var(--bg-subtle)', color: 'var(--accent-primary)', fontWeight: 600 }}>
                              {cls.student_count || 0} 人
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            <span>代號：{cls.account || cls.name}</span>
                            <span>{layoutCount} 組佈局</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 右側：選中班級基本設定與多組佈局 */}
              {currentClass ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* 基本資料卡片 */}
                  <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Edit2 size={18} color="var(--accent-primary)" />
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                          班級基本資料維護
                        </h2>
                        {!isAdmin && !isCurrentClassHomeroom && (
                          <span style={{ fontSize: '0.74rem', background: 'var(--bg-subtle)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                            (科系導師唯讀)
                          </span>
                        )}
                      </div>

                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteClass(currentClass.id, currentClass.class_name)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 12px', background: 'var(--danger-bg)', color: 'var(--danger)',
                            border: '1px solid var(--danger-border)', borderRadius: '6px',
                            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={14} /> 刪除班級
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleUpdateClass} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                          班級名稱
                        </label>
                        <input
                          type="text"
                          value={currentClass.class_name}
                          disabled={!isAdmin && !isCurrentClassHomeroom}
                          onChange={(e) => {
                            const val = e.target.value;
                            setClasses((prev) => prev.map((c) => (c.id === currentClass.id ? { ...c, class_name: val } : c)));
                          }}
                          required
                          style={{ width: '100%', padding: '9px 12px', background: (!isAdmin && !isCurrentClassHomeroom) ? 'var(--bg-subtle)' : '#ffffff', border: '1px solid var(--border-dark)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                          班級學生總人數 (應到席數)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="120"
                          disabled={!isAdmin && !isCurrentClassHomeroom}
                          value={currentClass.student_count || 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setClasses((prev) => prev.map((c) => (c.id === currentClass.id ? { ...c, student_count: val } : c)));
                          }}
                          required
                          style={{ width: '100%', padding: '9px 12px', background: (!isAdmin && !isCurrentClassHomeroom) ? 'var(--bg-subtle)' : '#ffffff', border: '1px solid var(--border-dark)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                        />
                      </div>

                      {(isAdmin || isCurrentClassHomeroom) && (
                        <div>
                          <button
                            type="submit"
                            style={{
                              width: '100%', padding: '10px 16px', background: 'var(--accent-primary)', color: '#ffffff',
                              border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            }}
                          >
                            <Save size={16} /> 儲存修改
                          </button>
                        </div>
                      )}
                    </form>
                  </div>

                  {/* 多組座位劃位佈局卡片 */}
                  <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <LayoutGrid size={20} color="var(--accent-primary)" />
                          座位劃位佈局 ({currentClass.seat_layout ? Object.keys(currentClass.seat_layout).length : 0} 組)
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '4px 0 0' }}>
                          支援自訂多組上課/考試佈局。{isTeacher && !isCurrentClassHomeroom && '作為科系導師，您可新增專屬佈局並編輯自己所創立之劃位。'}
                        </p>
                      </div>

                      <button
                        onClick={() => setIsAddLayoutOpen(true)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '7px 14px', background: 'var(--accent-light)', color: 'var(--accent-primary)',
                          border: '1px solid var(--border-color)', borderRadius: '6px',
                          fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        <Plus size={15} /> 新增座位佈局
                      </button>
                    </div>

                    {/* 佈局列表 */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                      {Object.entries(currentClass.seat_layout || {}).map(([layoutKey, layoutData]) => {
                        const isActive = currentClass.active_layout_key === layoutKey;
                        const seats = Array.isArray(layoutData?.seats) ? layoutData.seats : [];
                        const isCreator = layoutData?.created_by === session?.id;
                        const canEdit = isAdmin || isCurrentClassHomeroom || isCreator;

                        return (
                          <div
                            key={layoutKey}
                            style={{
                              border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                              borderRadius: '8px',
                              padding: '16px',
                              background: isActive ? 'var(--accent-light)' : '#ffffff',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: '12px',
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-primary)' }}>
                                  {layoutData?.name || layoutKey}
                                </span>
                                {isActive && (
                                  <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--accent-primary)', color: '#ffffff', fontWeight: 600 }}>
                                    使用中
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span>規格：{layoutData?.gridRows || 4} 排 × {layoutData?.gridCols || 5} 列 ({seats.length} 席)</span>
                                <span>建立者：{layoutData?.created_by_name || '預設配置'} {isCreator && '(您建立)'}</span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                              {!isActive && (
                                <button
                                  onClick={() => handleSetActiveLayout(layoutKey)}
                                  style={{
                                    flex: 1, padding: '6px 8px', borderRadius: '4px',
                                    background: '#ffffff', border: '1px solid var(--border-dark)',
                                    color: 'var(--text-primary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                                  }}
                                >
                                  套用此佈局
                                </button>
                              )}

                              <button
                                onClick={() => handleOpenEditor(layoutKey, layoutData)}
                                style={{
                                  flex: 1, padding: '6px 8px', borderRadius: '4px',
                                  background: canEdit ? 'var(--accent-primary)' : 'var(--bg-subtle)',
                                  border: 'none',
                                  color: canEdit ? '#ffffff' : 'var(--text-secondary)',
                                  fontSize: '0.78rem', fontWeight: 600,
                                  cursor: canEdit ? 'pointer' : 'not-allowed',
                                }}
                                title={canEdit ? '進入劃位編輯器' : '科系導師僅能編輯自己新增的劃位'}
                              >
                                {canEdit ? '劃位編輯' : '僅供檢視'}
                              </button>

                              {canEdit && (
                                <button
                                  onClick={() => handleDeleteLayout(layoutKey, layoutData)}
                                  style={{
                                    padding: '6px 10px', borderRadius: '4px',
                                    background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
                                    color: 'var(--danger)', fontSize: '0.78rem', cursor: 'pointer',
                                  }}
                                  title="刪除佈局"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  請從左側點選班級以檢視詳情
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 分頁 2: 學生名冊與身分維護 */}
        {/* ========================================================================= */}
        {mainTab === 'students' && (
          <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={22} color="var(--accent-primary)" />
                  {currentClass?.class_name || '班級'} · 學生名冊管理
                </h2>
                <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: '0.85rem' }}>
                  維護學號、座號與家長免登入防護驗證碼。
                  {isAdmin || isCurrentClassHomeroom 
                    ? '（具備新增、修改、刪除權限）' 
                    : '（科系導師權限：僅供檢視）'}
                </p>
              </div>

              {(isAdmin || isCurrentClassHomeroom) && (
                <button
                  onClick={() => setIsAddStudentOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', background: 'var(--accent-primary)', color: '#ffffff',
                    border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  <Plus size={15} /> 新增學生
                </button>
              )}
            </div>

            {loadingStudents ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                載入名冊中...
              </div>
            ) : students.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                目前此班級尚無學生紀錄
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>座號</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>學生姓名</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>正式學號 (Student ID)</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>家長驗證碼 (防護碼)</th>
                      {(isAdmin || isCurrentClassHomeroom) && (
                        <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>操作</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((st) => (
                      <tr key={st.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{st.seat_number} 號</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>{st.name}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{st.student_no}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--accent-primary)', fontWeight: 600 }}>{st.verify_code}</td>
                        {(isAdmin || isCurrentClassHomeroom) && (
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <button
                              onClick={() => setEditingStudent(st)}
                              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', marginRight: '10px' }}
                              title="編輯學生"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(st.id, st.name)}
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                              title="刪除學生"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 分頁 3: 全校教師帳號管理 (僅 Admin) */}
        {/* ========================================================================= */}
        {isAdmin && mainTab === 'teachers' && (
          <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={22} color="var(--accent-primary)" />
                  全校教師與班導師指派管理
                </h2>
                <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: '0.85rem' }}>
                  建立教師登入帳號、指定授課或班導師職責、維護全校師資架構
                </p>
              </div>

              <button
                onClick={() => setIsAddTeacherOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', background: 'var(--accent-primary)', color: '#ffffff',
                  border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                }}
              >
                <Plus size={15} /> 新增教師帳號
              </button>
            </div>

            {loadingTeachers ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                載入教師清單中...
              </div>
            ) : teachers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                目前學校尚無登記之教師帳號
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>教師姓名</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>公務信箱 / 登入帳號</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>職務身分</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700 }}>主要指派班級</th>
                      <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((t) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {t.name}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                          {t.email}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: '4px', fontSize: '0.76rem', fontWeight: 700,
                            background: t.is_homeroom ? '#ecfdf5' : 'var(--bg-subtle)',
                            color: t.is_homeroom ? '#059669' : 'var(--text-primary)',
                            border: `1px solid ${t.is_homeroom ? '#a7f3d0' : 'var(--border-color)'}`,
                          }}>
                            {t.is_homeroom ? '班導師 (Homeroom)' : '科系/任課導師'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                          {t.class_name}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleDeleteTeacher(t.id, t.name)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                            title="刪除教師"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 彈出視窗 1: 新增班級 Modal (Admin) */}
      {/* ========================================================================= */}
      {isAddClassModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45, 36, 30, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', maxWidth: '440px', width: '90%' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 16px' }}>建立新班級空間</h3>
            <form onSubmit={handleCreateClass} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>班級名稱</label>
                <input
                  type="text" required placeholder="例如: 高一仁班"
                  value={newClassName} onChange={(e) => setNewClassName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>班級代號</label>
                <input
                  type="text" placeholder="例如: class101"
                  value={newAccount} onChange={(e) => setNewAccount(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>初始預設學生人數</label>
                <input
                  type="number" min="1" max="100" value={newStudentCount}
                  onChange={(e) => setNewStudentCount(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button" onClick={() => setIsAddClassModalOpen(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'var(--accent-primary)', color: '#ffffff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                >
                  建立班級
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 彈出視窗 2: 新增座位佈局 Modal */}
      {/* ========================================================================= */}
      {isAddLayoutOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45, 36, 30, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', maxWidth: '420px', width: '90%' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 16px' }}>新增班級座位劃位佈局</h3>
            <form onSubmit={handleAddLayout} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>佈局名稱</label>
                <input
                  type="text" required placeholder="例如: 段考座位表、分組討論"
                  value={newLayoutName} onChange={(e) => setNewLayoutName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>座位排數 (Rows)</label>
                  <input
                    type="number" min="2" max="10" value={newLayoutRows}
                    onChange={(e) => setNewLayoutRows(parseInt(e.target.value, 10) || 4)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>座位列數 (Cols)</label>
                  <input
                    type="number" min="2" max="12" value={newLayoutCols}
                    onChange={(e) => setNewLayoutCols(parseInt(e.target.value, 10) || 5)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button" onClick={() => setIsAddLayoutOpen(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'var(--accent-primary)', color: '#ffffff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                >
                  建立佈局
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 彈出視窗 3: 新增學生 Modal */}
      {/* ========================================================================= */}
      {isAddStudentOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45, 36, 30, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', maxWidth: '420px', width: '90%' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 16px' }}>新增學生名冊資料</h3>
            <form onSubmit={handleCreateStudent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>學生姓名</label>
                <input
                  type="text" required placeholder="例如: 陳小華"
                  value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>座號</label>
                  <input
                    type="number" min="1" max="100" placeholder="1"
                    value={newStudentSeat} onChange={(e) => setNewStudentSeat(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>正式學號</label>
                  <input
                    type="text" placeholder="例如: 112001"
                    value={newStudentNo} onChange={(e) => setNewStudentNo(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>家長防護碼 (生日4碼或座號)</label>
                <input
                  type="text" placeholder="例如: 0521"
                  value={newStudentCode} onChange={(e) => setNewStudentCode(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button" onClick={() => setIsAddStudentOpen(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'var(--accent-primary)', color: '#ffffff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                >
                  新增學生
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 彈出視窗 4: 編輯學生 Modal */}
      {/* ========================================================================= */}
      {editingStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45, 36, 30, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', maxWidth: '420px', width: '90%' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 16px' }}>編輯學生資料</h3>
            <form onSubmit={handleUpdateStudent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>學生姓名</label>
                <input
                  type="text" required value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>座號</label>
                  <input
                    type="number" min="1" max="100" value={editingStudent.seat_number}
                    onChange={(e) => setEditingStudent({ ...editingStudent, seat_number: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>正式學號</label>
                  <input
                    type="text" value={editingStudent.student_no}
                    onChange={(e) => setEditingStudent({ ...editingStudent, student_no: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>家長防護碼</label>
                <input
                  type="text" value={editingStudent.verify_code}
                  onChange={(e) => setEditingStudent({ ...editingStudent, verify_code: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button" onClick={() => setEditingStudent(null)}
                  style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'var(--accent-primary)', color: '#ffffff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                >
                  儲存修改
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 彈出視窗 5: 新增教師帳號 Modal (僅 Admin) */}
      {/* ========================================================================= */}
      {isAddTeacherOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45, 36, 30, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '28px', maxWidth: '460px', width: '90%' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 16px' }}>開通與指派教師帳號</h3>
            <form onSubmit={handleCreateTeacher} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>教師真實姓名</label>
                <input
                  type="text" required placeholder="例如: 王大明老師"
                  value={newTeacherName} onChange={(e) => setNewTeacherName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>公務信箱 / 帳號</label>
                <input
                  type="email" required placeholder="teacher@tp.edu.tw"
                  value={newTeacherEmail} onChange={(e) => setNewTeacherEmail(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>初始密碼</label>
                <input
                  type="password" required value={newTeacherPassword}
                  onChange={(e) => setNewTeacherPassword(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>指派負責班級</label>
                <select
                  value={newTeacherClassId}
                  onChange={(e) => setNewTeacherClassId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-dark)', boxSizing: 'border-box' }}
                >
                  <option value="">-- 暫無特定指派 --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.class_name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox" id="homeroomCheck"
                  checked={newTeacherIsHomeroom}
                  onChange={(e) => setNewTeacherIsHomeroom(e.target.checked)}
                />
                <label htmlFor="homeroomCheck" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  設定為該班「班導師」 (具備名冊修改與完整劃位權限)
                </label>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button" onClick={() => setIsAddTeacherOpen(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '10px', borderRadius: '6px', background: 'var(--accent-primary)', color: '#ffffff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                >
                  開通教師帳號
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 劃位編輯器 Modal */}
      {isSeatEditorOpen && currentClass && (
        <SeatMapEditorModal
          isOpen={isSeatEditorOpen}
          classId={currentClass.id}
          layoutKey={editingLayoutKey || currentClass.active_layout_key}
          initialLayout={currentClass.seat_layout}
          onClose={() => setIsSeatEditorOpen(false)}
          onSaveSuccess={handleEditorSaveSuccess}
        />
      )}
    </div>
  );
};

export default Management;
