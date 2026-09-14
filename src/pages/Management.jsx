// ==============================================================================
// 班級自動化點名系統 - 獨立管理頁面 (Management.jsx)
// 單獨全螢幕後台網頁，不依賴前台側邊欄；管理者 (admin / admin) 於本頁面獨立登入與維護
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  School, Plus, Edit2, Trash2, Save, ShieldCheck, Check, 
  LayoutGrid, Users, Key, AlertCircle, ArrowLeft, RefreshCw, 
  Settings, CheckCircle, ExternalLink, LogOut, Lock, User
} from 'lucide-react';
import { 
  getAuthSession, getAllClasses, createClassAccount, 
  updateClassInfo, deleteClassAccount, loginAdmin, clearAuthSession 
} from '../services/authService';
import { generateGridSeats } from '../services/seatOccupancyService';
import SeatMapEditorModal from '../components/SeatMapEditorModal';

export const Management = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState(getAuthSession());
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState(null);

  // 獨立管理者登入表單狀態
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('admin');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 新增班級表單 Modal
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [newAccount, setNewAccount] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [newStudentCount, setNewStudentCount] = useState(38);
  const [newPassword, setNewPassword] = useState('123456');
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

  // 動態更新網頁標題
  useEffect(() => {
    document.title = '班級空間管理後台 - 班級自動化點名系統';
    return () => {
      document.title = '班級自動化點名系統';
    };
  }, []);

  const loadClasses = async () => {
    setLoading(true);
    try {
      const list = await getAllClasses();
      setClasses(list);
      if (list.length > 0 && !selectedClassId) {
        setSelectedClassId(list[0].id);
      }
    } catch (err) {
      console.error('[Management] 載入班級清單失敗:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadClasses();
    }
  }, [isAdmin]);

  // 當前選中的班級
  const currentClass = classes.find((c) => c.id === selectedClassId) || null;

  // 獨立登入處理
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await loginAdmin(loginUsername, loginPassword);
      if (res.success) {
        const nextSession = getAuthSession();
        setSession(nextSession);
      } else {
        setLoginError(res.message || '管理者帳號或密碼錯誤');
      }
    } catch (err) {
      setLoginError('登入發生異常，請重試');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 獨立登出處理
  const handleAdminLogout = () => {
    clearAuthSession();
    setSession(null);
  };

  // 處理新增班級
  const handleCreateClass = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    const res = await createClassAccount({
      account: newAccount,
      class_name: newClassName,
      student_count: newStudentCount,
      password: newPassword,
    });

    if (res.success) {
      setIsAddClassModalOpen(false);
      setNewAccount('');
      setNewClassName('');
      setNewStudentCount(38);
      setNewPassword('123456');
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

  // 處理更新班級基本資料
  const handleUpdateClass = async (e) => {
    e.preventDefault();
    if (!currentClass) return;
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

  // 處理刪除班級
  const handleDeleteClass = async (classId, className) => {
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

  // 處理新增座位佈局
  const handleAddLayout = async (e) => {
    e.preventDefault();
    if (!currentClass) return;

    const currentLayouts = { ...(currentClass.seat_layout || {}) };
    const nextKey = `layout_${Date.now()}`;
    const generatedSeats = generateGridSeats(newLayoutRows, newLayoutCols, 640, 480);

    currentLayouts[nextKey] = {
      name: newLayoutName || `座位佈局 ${Object.keys(currentLayouts).length + 1}`,
      base_width: 640,
      base_height: 480,
      gridRows: newLayoutRows,
      gridCols: newLayoutCols,
      seats: generatedSeats,
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

  // 處理刪除座位佈局
  const handleDeleteLayout = async (layoutKey, layoutName) => {
    if (!currentClass) return;
    const currentLayouts = { ...(currentClass.seat_layout || {}) };
    if (Object.keys(currentLayouts).length <= 1) {
      alert('至少必須保留一組座位佈局！');
      return;
    }
    if (!window.confirm(`確定要刪除座位佈局「${layoutName}」嗎？`)) return;

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
    }
  };

  // 劃位儲存成功回呼
  const handleEditorSaveSuccess = async () => {
    await loadClasses();
    setIsSeatEditorOpen(false);
    setActionSuccess('座位劃位配置已成功儲存！');
    setTimeout(() => setActionSuccess(''), 3000);
  };

  // ============================================================================
  // 狀態 A：尚未登入管理者（獨立登入卡片介面）
  // ============================================================================
  if (!isAdmin) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
      }}>
        {/* 登入卡片主體 */}
        <div style={{
          width: '100%',
          maxWidth: '440px',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.06)',
          padding: '36px 32px',
          boxSizing: 'border-box',
        }}>
          {/* 頂部圖示與標題 */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              background: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.15)',
            }}>
              <ShieldCheck size={28} />
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              班級空間管理後台
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              本頁面為單獨管理網頁，僅供系統管理者登入以維護班級名冊與座位配置
            </p>
          </div>

          {/* 錯誤訊息 */}
          {loginError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '6px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '0.85rem',
              marginBottom: '20px',
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{loginError}</span>
            </div>
          )}

          {/* 登入表單 */}
          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                管理者帳號
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="admin"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                    color: '#0f172a',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                管理者密碼
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="admin"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                    color: '#0f172a',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              style={{
                marginTop: '8px',
                width: '100%',
                padding: '11px',
                borderRadius: '6px',
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'opacity 0.15s ease',
                opacity: isLoggingIn ? 0.7 : 1,
              }}
            >
              <ShieldCheck size={18} />
              {isLoggingIn ? '登入驗證中...' : '登入管理後台'}
            </button>
          </form>

          {/* 返回前台連結 */}
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
            <button
              onClick={() => navigate('/history')}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
              }}
            >
              <ArrowLeft size={14} />
              返回前台考勤歷史簿
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 狀態 B：已登入管理者（獨立全螢幕管理後台網頁）
  // ============================================================================
  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
    }}>
      {/* 獨立管理後台專屬頂部 Navigation Bar */}
      <header style={{
        height: '64px',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
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
            background: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
          }}>
            <School size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              班級自動化點名系統
              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontWeight: 600 }}>
                獨立管理後台
              </span>
            </div>
          </div>
        </div>

        {/* 右側操作：身分資訊、返回前台、登出 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#475569', background: '#f8fafc', padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <ShieldCheck size={16} color="#0284c7" />
            <span>目前身分：<strong>系統管理者 (admin)</strong></span>
          </div>

          <button
            onClick={() => navigate('/history')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '6px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <ExternalLink size={14} />
            查看前台考勤紀錄
          </button>

          <button
            onClick={handleAdminLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '6px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <LogOut size={14} />
            登出後台
          </button>
        </div>
      </header>

      {/* 獨立後台內容區 (全寬居中佈局，寬敞明瞭) */}
      <main style={{ flex: 1, padding: '28px', maxWidth: '1440px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {/* 操作成功 / 失敗 Banner */}
        {actionSuccess && (
          <div style={{
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
            padding: '12px 18px',
            borderRadius: '6px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}>
            <CheckCircle size={18} />
            <span>{actionSuccess}</span>
          </div>
        )}

        {actionError && (
          <div style={{
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            padding: '12px 18px',
            borderRadius: '6px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}>
            <AlertCircle size={18} />
            <span>{actionError}</span>
          </div>
        )}

        {/* 頂部標題與按鈕操作列 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
              班級與座位空間管理
            </h1>
            <p style={{ color: '#64748b', margin: '6px 0 0', fontSize: '0.88rem' }}>
              管理校內各班級帳號、學生總人數設定，以及為各班劃設專屬的多組命名座位佈局
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={loadClasses}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: '#ffffff', color: '#0f172a',
                border: '1px solid #cbd5e1', padding: '8px 14px',
                borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 重新整理名冊
            </button>

            <button
              onClick={() => setIsAddClassModalOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: '#0f172a', color: '#ffffff',
                border: 'none', padding: '8px 18px',
                borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)',
              }}
            >
              <Plus size={16} /> 新增班級
            </button>
          </div>
        </div>

        {/* 主體左右佈局：左側班級列表 (320px) + 右側班級詳情與多佈局管理 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '24px', alignItems: 'start' }}>
          {/* 左側：班級列表卡片 */}
          <div style={{
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                班級名冊 ({classes.length})
              </h2>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                載入班級中...
              </div>
            ) : classes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b' }}>
                <School size={36} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                <p style={{ margin: 0, fontSize: '0.85rem' }}>目前尚未建立任何班級</p>
                <button
                  onClick={() => setIsAddClassModalOpen(true)}
                  style={{
                    marginTop: '12px',
                    padding: '6px 14px',
                    background: '#2563eb',
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
                        border: `1px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                        background: isSelected ? '#f0f9ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: isSelected ? '#0369a1' : '#0f172a' }}>
                          {cls.class_name || cls.account}
                        </span>
                        <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: isSelected ? '#bae6fd' : '#f1f5f9', color: isSelected ? '#2563eb' : '#64748b', fontWeight: 600 }}>
                          {cls.student_count || 0} 人
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                        <span>帳號：{cls.account}</span>
                        <span>{layoutCount} 組佈局</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 右側：選中班級之基本資料維護與多組座位佈局劃設 */}
          {currentClass ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 卡片 1: 班級基本資訊維護 (含學生總人數) */}
              <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Edit2 size={18} color="#2563eb" />
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                      班級基本資料維護
                    </h2>
                  </div>

                  <button
                    onClick={() => handleDeleteClass(currentClass.id, currentClass.class_name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '6px 12px', background: '#fee2e2', color: '#dc2626',
                      border: '1px solid #fecaca', borderRadius: '6px',
                      fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={14} /> 刪除班級
                  </button>
                </div>

                <form onSubmit={handleUpdateClass} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      班級代號 / 登入帳號 (固定)
                    </label>
                    <input
                      type="text"
                      value={currentClass.account}
                      disabled
                      style={{ width: '100%', padding: '9px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#64748b', fontSize: '0.88rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      班級名稱
                    </label>
                    <input
                      type="text"
                      value={currentClass.class_name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setClasses((prev) => prev.map((c) => (c.id === currentClass.id ? { ...c, class_name: val } : c)));
                      }}
                      required
                      style={{ width: '100%', padding: '9px 12px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontSize: '0.88rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      班級學生總人數 (應到人數)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={currentClass.student_count || 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || 0;
                        setClasses((prev) => prev.map((c) => (c.id === currentClass.id ? { ...c, student_count: val } : c)));
                      }}
                      required
                      style={{ width: '100%', padding: '9px 12px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#0f172a', fontSize: '0.88rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <button
                      type="submit"
                      style={{
                        width: '100%', padding: '10px 16px', background: '#2563eb', color: '#ffffff',
                        border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      }}
                    >
                      <Save size={16} /> 儲存修改
                    </button>
                  </div>
                </form>
              </div>

              {/* 卡片 2: 多組命名座位佈局管理與劃位設定 */}
              <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <LayoutGrid size={20} color="#2563eb" />
                      座位劃位佈局 ({currentClass.seat_layout ? Object.keys(currentClass.seat_layout).length : 0} 組)
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '4px 0 0' }}>
                      可為該班級建立多組專屬座位配置（如「一般上課」、「分組討論」、「期末測驗」），前台儀表板可隨時切換
                    </p>
                  </div>

                  <button
                    onClick={() => setIsAddLayoutOpen(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '7px 14px', background: '#f0fdf4', color: '#15803d',
                      border: '1px solid #bbf7d0', borderRadius: '6px',
                      fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <Plus size={15} /> 新增座位佈局
                  </button>
                </div>

                {/* 座位佈局清單 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {Object.entries(currentClass.seat_layout || {}).map(([layoutKey, layoutData]) => {
                    const isActive = currentClass.active_layout_key === layoutKey;
                    const seats = Array.isArray(layoutData?.seats) ? layoutData.seats : [];

                    return (
                      <div
                        key={layoutKey}
                        style={{
                          border: `1px solid ${isActive ? '#2563eb' : '#e2e8f0'}`,
                          borderRadius: '8px',
                          padding: '16px',
                          background: isActive ? '#f8fafc' : '#ffffff',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                              {layoutData.name || layoutKey}
                            </div>
                            {isActive && (
                              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: '#e0f2fe', color: '#2563eb', fontWeight: 700 }}>
                                預設啟用
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', gap: '12px' }}>
                            <span>座位數：<strong>{seats.length}</strong> 席</span>
                            <span>網格：{layoutData.gridRows || 4} × {layoutData.gridCols || 5}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                          <button
                            onClick={() => {
                              setEditingLayoutKey(layoutKey);
                              setIsSeatEditorOpen(true);
                            }}
                            style={{
                              flex: 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                              padding: '7px', background: '#2563eb', color: '#ffffff',
                              border: 'none', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            <Settings size={14} /> 編輯劃位 (視覺化)
                          </button>

                          {!isActive && (
                            <button
                              onClick={async () => {
                                await updateClassInfo(currentClass.id, { active_layout_key: layoutKey });
                                await loadClasses();
                              }}
                              style={{
                                padding: '7px 10px', background: '#ffffff', color: '#475569',
                                border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
                              }}
                              title="設為前台預設啟用"
                            >
                              設為預設
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteLayout(layoutKey, layoutData.name || layoutKey)}
                            style={{
                              padding: '7px 10px', background: '#ffffff', color: '#dc2626',
                              border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer',
                            }}
                            title="刪除此佈局"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
              請由左側選擇班級以檢視詳細資料與座位佈局
            </div>
          )}
        </div>
      </main>

      {/* 新增班級彈窗 Modal */}
      {isAddClassModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px',
        }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '440px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>
              ➕ 新增班級
            </h3>

            <form onSubmit={handleCreateClass} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  班級代號 (登入帳號，例如 301)
                </label>
                <input
                  type="text"
                  value={newAccount}
                  onChange={(e) => setNewAccount(e.target.value)}
                  placeholder="301"
                  required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  班級名稱 (例如 三年一班)
                </label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="三年一班"
                  required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  班級學生總人數 (應到人數)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={newStudentCount}
                  onChange={(e) => setNewStudentCount(parseInt(e.target.value, 10) || 38)}
                  required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  初始密碼
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddClassModalOpen(false)}
                  style={{ flex: 1, padding: '9px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '9px', background: '#0284c7', border: 'none', borderRadius: '6px', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
                >
                  確認建立
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 新增佈局彈窗 Modal */}
      {isAddLayoutOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px',
        }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 16px', color: '#0f172a' }}>
              ➕ 新增座位佈局
            </h3>

            <form onSubmit={handleAddLayout} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  佈局名稱 (例如 期中考排列)
                </label>
                <input
                  type="text"
                  value={newLayoutName}
                  onChange={(e) => setNewLayoutName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    預設排數 (橫向)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newLayoutRows}
                    onChange={(e) => setNewLayoutRows(parseInt(e.target.value, 10) || 4)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    預設列數 (縱向)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={newLayoutCols}
                    onChange={(e) => setNewLayoutCols(parseInt(e.target.value, 10) || 5)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddLayoutOpen(false)}
                  style={{ flex: 1, padding: '9px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '9px', background: '#15803d', border: 'none', borderRadius: '6px', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
                >
                  建立佈局
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 視覺化劃位彈窗 (調用 SeatMapEditorModal，傳入當前選中佈局) */}
      {isSeatEditorOpen && currentClass && editingLayoutKey && (
        <SeatMapEditorModal
          isOpen={isSeatEditorOpen}
          onClose={() => setIsSeatEditorOpen(false)}
          onSaveSuccess={handleEditorSaveSuccess}
          initialClassId={currentClass.id}
          initialLayoutKey={editingLayoutKey}
          initialLayoutData={currentClass.seat_layout?.[editingLayoutKey]}
        />
      )}
    </div>
  );
};

export default Management;
