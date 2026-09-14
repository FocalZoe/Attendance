// ==============================================================================
// 班級自動化點名系統 - 獨立管理頁面 (Management.jsx)
// 單獨全螢幕後台網頁，米白咖啡色系 (Warm Cream & Rich Coffee)，純淨典雅
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
import Toast from '../components/Toast';

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
    } catch {
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
  // 狀態 A：尚未登入管理者（獨立登入卡片介面 - 溫潤米白咖啡調）
  // ============================================================================
  if (!isAdmin) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        background: 'var(--bg-color)',
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
          border: '1px solid var(--border-color)',
          boxShadow: 'none',
          padding: '36px 32px',
          boxSizing: 'border-box',
        }}>
          {/* 頂部圖示與標題 */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              background: 'var(--accent-primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <ShieldCheck size={28} />
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              班級空間管理後台
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
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
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger)',
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
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                管理者帳號
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
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
                    border: '1px solid var(--border-dark)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                管理者密碼
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
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
                    border: '1px solid var(--border-dark)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                    color: 'var(--text-primary)',
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
                background: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background 0.15s ease',
                opacity: isLoggingIn ? 0.7 : 1,
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'var(--accent-primary)')}
            >
              <ShieldCheck size={18} />
              {isLoggingIn ? '登入驗證中...' : '登入管理後台'}
            </button>
          </form>

          {/* 返回前台連結 */}
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
            <button
              onClick={() => navigate('/history')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
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
  // 狀態 B：已登入管理者（獨立全螢幕管理後台網頁 - 溫潤米白咖啡調）
  // ============================================================================
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
      {/* 獨立管理後台專屬頂部 Navigation Bar */}
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
              班級自動化點名系統
              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--accent-light)', color: 'var(--accent-primary)', border: '1px solid var(--border-color)', fontWeight: 600 }}>
                獨立管理後台
              </span>
            </div>
          </div>
        </div>

        {/* 右側操作：身分資訊、返回前台、登出 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'var(--accent-light)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <ShieldCheck size={16} color="var(--accent-primary)" />
            <span>目前身分：<strong style={{ color: 'var(--accent-primary)' }}>系統管理者 (admin)</strong></span>
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
              border: '1px solid var(--border-dark)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#ffffff')}
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
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger)',
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
        {/* 操作成功 / 失敗 Toast (Portal 浮動通知，零版面推擠) */}
        {actionSuccess && (
          <Toast message={actionSuccess} type="success" onClose={() => setActionSuccess('')} />
        )}
        {actionError && (
          <Toast message={actionError} type="error" onClose={() => setActionError('')} />
        )}

        {/* 頂部標題與按鈕操作列 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              班級與座位空間管理
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0', fontSize: '0.88rem' }}>
              管理校內各班級帳號、學生總人數設定，以及為各班劃設專屬的多組命名座位佈局
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={loadClasses}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: '#ffffff', color: 'var(--text-primary)',
                border: '1px solid var(--border-color)', padding: '8px 14px',
                borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')}
              onMouseOut={(e) => (e.currentTarget.style.background = '#ffffff')}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 重新整理名冊
            </button>

            <button
              onClick={() => setIsAddClassModalOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'var(--accent-primary)', color: '#ffffff',
                border: 'none', padding: '8px 18px',
                borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'var(--accent-primary)')}
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
            border: '1px solid var(--border-color)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                班級名冊 ({classes.length})
              </h2>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                載入班級中...
              </div>
            ) : classes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-secondary)' }}>
                <School size={36} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                <p style={{ margin: 0, fontSize: '0.85rem' }}>目前尚未建立任何班級</p>
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
                  onMouseOver={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'var(--accent-primary)')}
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
                        border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                        background: isSelected ? 'var(--accent-light)' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                          {cls.class_name || cls.account}
                        </span>
                        <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: isSelected ? '#e8dfd5' : 'var(--bg-subtle)', color: 'var(--accent-primary)', fontWeight: 600 }}>
                          {cls.student_count || 0} 人
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
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
              <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Edit2 size={18} color="var(--accent-primary)" />
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      班級基本資料維護
                    </h2>
                  </div>

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
                </div>

                <form onSubmit={handleUpdateClass} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      班級代號 / 登入帳號 (固定)
                    </label>
                    <input
                      type="text"
                      value={currentClass.account}
                      disabled
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
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
                      style={{ width: '100%', padding: '9px 12px', background: '#ffffff', border: '1px solid var(--border-dark)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.88rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
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
                      style={{ width: '100%', padding: '9px 12px', background: '#ffffff', border: '1px solid var(--border-dark)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.88rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <button
                      type="submit"
                      style={{
                        width: '100%', padding: '10px 16px', background: 'var(--accent-primary)', color: '#ffffff',
                        border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
                      onMouseOut={(e) => (e.currentTarget.style.background = 'var(--accent-primary)')}
                    >
                      <Save size={16} /> 儲存修改
                    </button>
                  </div>
                </form>
              </div>

              {/* 卡片 2: 多組命名座位佈局管理與劃位設定 */}
              <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <LayoutGrid size={20} color="var(--accent-primary)" />
                      座位劃位佈局 ({currentClass.seat_layout ? Object.keys(currentClass.seat_layout).length : 0} 組)
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '4px 0 0' }}>
                      可為該班級建立多組專屬座位配置（如「一般上課」、「分組討論」、「期末測驗」），前台儀表板可隨時切換
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

                {/* 座位佈局清單 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {Object.entries(currentClass.seat_layout || {}).map(([layoutKey, layoutData]) => {
                    const isActive = currentClass.active_layout_key === layoutKey;
                    const seats = Array.isArray(layoutData?.seats) ? layoutData.seats : [];

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
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                              {layoutData.name || layoutKey}
                            </div>
                            {isActive && (
                              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: '#e8dfd5', color: 'var(--accent-primary)', fontWeight: 700 }}>
                                預設啟用
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '12px' }}>
                            <span>座位數：<strong style={{ color: 'var(--text-primary)' }}>{seats.length}</strong> 席</span>
                            <span>網格：{layoutData.gridRows || 4} × {layoutData.gridCols || 5}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                          <button
                            onClick={() => {
                              setEditingLayoutKey(layoutKey);
                              setIsSeatEditorOpen(true);
                            }}
                            style={{
                              flex: 1,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                              padding: '7px', background: 'var(--accent-primary)', color: '#ffffff',
                              border: 'none', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
                            onMouseOut={(e) => (e.currentTarget.style.background = 'var(--accent-primary)')}
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
                                padding: '7px 10px', background: '#ffffff', color: 'var(--text-secondary)',
                                border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
                              }}
                              title="設為前台預設啟用"
                            >
                              設為預設
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteLayout(layoutKey, layoutData.name || layoutKey)}
                            style={{
                              padding: '7px 10px', background: '#ffffff', color: 'var(--danger)',
                              border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer',
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
            <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              請由左側選擇班級以檢視詳細資料與座位佈局
            </div>
          )}
        </div>
      </main>

      {/* 新增班級彈窗 Modal */}
      {isAddClassModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(45, 36, 30, 0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px',
        }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '440px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
              ➕ 新增班級
            </h3>

            <form onSubmit={handleCreateClass} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  班級代號 (登入帳號，例如 301)
                </label>
                <input
                  type="text"
                  value={newAccount}
                  onChange={(e) => setNewAccount(e.target.value)}
                  placeholder="301"
                  required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-dark)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', background: '#ffffff', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  班級名稱 (例如 三年一班)
                </label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="三年一班"
                  required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-dark)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', background: '#ffffff', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  班級學生總人數 (應到人數)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={newStudentCount}
                  onChange={(e) => setNewStudentCount(parseInt(e.target.value, 10) || 38)}
                  required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-dark)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', background: '#ffffff', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  初始密碼
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-dark)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', background: '#ffffff', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddClassModalOpen(false)}
                  style={{ flex: 1, padding: '9px', background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '9px', background: 'var(--accent-primary)', border: 'none', borderRadius: '6px', color: '#ffffff', fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseOver={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'var(--accent-primary)')}
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
          position: 'fixed', inset: 0, background: 'rgba(45, 36, 30, 0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px',
        }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '420px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
              ➕ 新增座位佈局
            </h3>

            <form onSubmit={handleAddLayout} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  佈局名稱 (例如 期中考排列)
                </label>
                <input
                  type="text"
                  value={newLayoutName}
                  onChange={(e) => setNewLayoutName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-dark)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', background: '#ffffff', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    預設排數 (橫向)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newLayoutRows}
                    onChange={(e) => setNewLayoutRows(parseInt(e.target.value, 10) || 4)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-dark)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', background: '#ffffff', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    預設列數 (縱向)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={newLayoutCols}
                    onChange={(e) => setNewLayoutCols(parseInt(e.target.value, 10) || 5)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-dark)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', background: '#ffffff', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddLayoutOpen(false)}
                  style={{ flex: 1, padding: '9px', background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '9px', background: 'var(--accent-primary)', border: 'none', borderRadius: '6px', color: '#ffffff', fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseOver={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'var(--accent-primary)')}
                >
                  建立佈局
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 視覺化劃位彈窗 */}
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
