// ==============================================================================
// 班級自動化點名系統 - 獨立管理頁面 (Management.jsx)
// 專供管理者 (admin / admin) 登入使用，負責班級 CRUD 與多組座位佈局劃設維護
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { 
  School, Plus, Edit2, Trash2, Save, ShieldCheck, Check, 
  LayoutGrid, Users, Key, AlertCircle, ArrowLeft, RefreshCw, 
  Settings, CheckCircle, ExternalLink 
} from 'lucide-react';
import { 
  getAuthSession, getAllClasses, createClassAccount, 
  updateClassInfo, deleteClassAccount 
} from '../services/authService';
import { generateGridSeats } from '../services/seatOccupancyService';
import SeatMapEditorModal from '../components/SeatMapEditorModal';

export const Management = () => {
  const [session, setSession] = useState(getAuthSession());
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState(null);

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
  const handleSaveClassBasicInfo = async (e) => {
    e.preventDefault();
    if (!currentClass) return;

    setActionError('');
    setActionSuccess('');

    const res = await updateClassInfo(currentClass.id, {
      class_name: currentClass.class_name,
      student_count: currentClass.student_count,
    });

    if (res.success) {
      setActionSuccess('班級基本資料已儲存！');
      await loadClasses();
      setTimeout(() => setActionSuccess(''), 3000);
    } else {
      setActionError(res.message || '儲存失敗');
    }
  };

  // 處理刪除班級
  const handleDeleteClass = async (classId, className) => {
    if (!window.confirm(`確定要刪除班級「${className}」嗎？此動作無法復原。`)) {
      return;
    }

    const res = await deleteClassAccount(classId);
    if (res.success) {
      setActionSuccess(`班級「${className}」已刪除`);
      setSelectedClassId(null);
      await loadClasses();
      setTimeout(() => setActionSuccess(''), 3000);
    } else {
      setActionError(res.message || '刪除失敗');
    }
  };

  // 處理切換啟用佈局
  const handleSetActiveLayout = async (layoutKey) => {
    if (!currentClass) return;
    const res = await updateClassInfo(currentClass.id, {
      active_layout_key: layoutKey,
    });
    if (res.success) {
      await loadClasses();
    }
  };

  // 處理新增座位佈局
  const handleAddLayout = async (e) => {
    e.preventDefault();
    if (!currentClass) return;

    const currentLayouts = { ...(currentClass.seat_layout || {}) };
    const nextKey = `layout_${Date.now()}`;
    const safeRows = Math.max(1, parseInt(newLayoutRows, 10) || 4);
    const safeCols = Math.max(1, parseInt(newLayoutCols, 10) || 5);

    currentLayouts[nextKey] = {
      name: newLayoutName.trim() || `佈局 (${safeRows}×${safeCols})`,
      gridRows: safeRows,
      gridCols: safeCols,
      base_width: 640,
      base_height: 480,
      seats: generateGridSeats(safeRows, safeCols, 640, 480),
    };

    const res = await updateClassInfo(currentClass.id, {
      seat_layout: currentLayouts,
    });

    if (res.success) {
      setIsAddLayoutOpen(false);
      setNewLayoutName('新座位佈局');
      await loadClasses();
      setActionSuccess('新座位佈局已新增！');
      setTimeout(() => setActionSuccess(''), 3000);
    } else {
      setActionError(res.message || '新增佈局失敗');
    }
  };

  // 處理刪除座位佈局
  const handleDeleteLayout = async (layoutKey, layoutName) => {
    if (!currentClass) return;
    const currentLayouts = { ...(currentClass.seat_layout || {}) };
    const keys = Object.keys(currentLayouts);

    if (keys.length <= 1) {
      alert('每個班級必須至少保留一組座位佈局');
      return;
    }

    if (!window.confirm(`確定要刪除座位佈局「${layoutName}」嗎？`)) {
      return;
    }

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

  // 非管理者防護介面
  if (!isAdmin) {
    return (
      <div className="animate-fade-in" style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '12px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <ShieldCheck size={32} />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>
          管理者專屬獨立頁面
        </h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
          本管理頁面僅供系統管理者 (<code>admin</code>) 進行班級名冊與多組座位劃位佈局之維護。一般授課與日常點名請由班級帳號登入即時儀表板。
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '60px' }}>
      {/* 頂部標題列 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            班級空間管理後台 <ShieldCheck size={26} color="var(--accent-primary)" />
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: '0.9rem' }}>
            管理者專屬：建立與維護班級名冊、學生總人數與多組命名座位劃位佈局
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={loadClasses}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: '#ffffff', color: '#0f172a',
              border: '1px solid var(--glass-border)', padding: '8px 14px',
              borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 重新整理
          </button>

          <button
            onClick={() => setIsAddClassModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'var(--accent-primary)', color: '#ffffff',
              border: '1px solid var(--accent-primary)', padding: '8px 16px',
              borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={16} /> ➕ 新增班級
          </button>
        </div>
      </div>

      {/* 提示訊息 */}
      {actionSuccess && (
        <div style={{ marginBottom: '16px', padding: '10px 16px', borderRadius: '6px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={16} /> {actionSuccess}
        </div>
      )}

      {actionError && (
        <div style={{ marginBottom: '16px', padding: '10px 16px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} /> {actionError}
        </div>
      )}

      {/* 主工作區：左側班級列表，右側班級詳細與佈局 */}
      <div style={{ display: 'grid', gridTemplateColumns: classes.length > 0 ? '280px 1fr' : '1fr', gap: '20px', alignItems: 'start' }}>
        {/* 左側：班級列表清單 */}
        <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid var(--glass-border)', padding: '16px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>班級名冊 ({classes.length})</span>
          </div>

          {classes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: '0.85rem' }}>
              <School size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <div>目前尚未建立任何班級</div>
              <button
                onClick={() => setIsAddClassModalOpen(true)}
                style={{ marginTop: '12px', padding: '6px 12px', borderRadius: '6px', background: '#eff6ff', color: 'var(--accent-primary)', border: '1px solid #bfdbfe', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
              >
                立即建立第一個班級
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {classes.map((c) => {
                const isSelected = c.id === selectedClassId;
                const layoutCount = Object.keys(c.seat_layout || {}).length;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedClassId(c.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid #e2e8f0',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.92rem', color: isSelected ? 'var(--accent-primary)' : '#0f172a' }}>
                        {c.class_name}
                      </span>
                      <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                        {c.account}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '0.75rem', color: '#64748b' }}>
                      <span>👥 {c.student_count || 0} 人</span>
                      <span>📐 {layoutCount} 組佈局</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 右側：當前班級詳細設定與多座位佈局管理 */}
        {currentClass ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 班級基本資訊維護卡片 */}
            <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid var(--glass-border)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <School size={20} color="var(--accent-primary)" />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                    {currentClass.class_name} ({currentClass.account})
                  </h3>
                </div>
                <button
                  onClick={() => handleDeleteClass(currentClass.id, currentClass.class_name)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  <Trash2 size={14} /> 刪除班級
                </button>
              </div>

              <form onSubmit={handleSaveClassBasicInfo} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    班級名稱
                  </label>
                  <input
                    type="text"
                    required
                    value={currentClass.class_name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setClasses((prev) => prev.map((c) => (c.id === currentClass.id ? { ...c, class_name: val } : c)));
                    }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    學生總人數 (應到人數)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="300"
                    required
                    value={currentClass.student_count || 0}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                      setClasses((prev) => prev.map((c) => (c.id === currentClass.id ? { ...c, student_count: val } : c)));
                    }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', padding: '9px', borderRadius: '6px', background: 'var(--accent-primary)', color: '#ffffff', border: 'none', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}
                  >
                    <Save size={16} /> 儲存班級資料
                  </button>
                </div>
              </form>
            </div>

            {/* 多組座位劃位佈局管理區 */}
            <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid var(--glass-border)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <LayoutGrid size={18} color="var(--accent-primary)" /> 多組命名座位佈局
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    為此班級劃設多種上課情境（如平時課堂、考試梅花座、小組研討等）
                  </span>
                </div>

                <button
                  onClick={() => setIsAddLayoutOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '6px', background: '#eff6ff', color: 'var(--accent-primary)', border: '1px solid #bfdbfe', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Plus size={15} /> 新增座位佈局
                </button>
              </div>

              {/* 佈局清單 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {Object.entries(currentClass.seat_layout || {}).map(([lKey, layout]) => {
                  const isActive = currentClass.active_layout_key === lKey;
                  const seatCount = Array.isArray(layout.seats) ? layout.seats.length : (layout.gridRows * layout.gridCols || 0);

                  return (
                    <div
                      key={lKey}
                      style={{
                        padding: '16px',
                        borderRadius: '8px',
                        border: isActive ? '2px solid var(--accent-primary)' : '1px solid #e2e8f0',
                        background: isActive ? '#f8fafc' : '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px',
                        position: 'relative',
                      }}
                    >
                      {isActive && (
                        <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Check size={12} /> 預設啟用中
                        </div>
                      )}

                      <div>
                        <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                          {layout.name || '未命名佈局'}
                        </h4>
                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          排列：{layout.gridRows} 排 × {layout.gridCols} 欄 · 共 {seatCount} 席座位
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                        {!isActive && (
                          <button
                            onClick={() => handleSetActiveLayout(lKey)}
                            style={{ flex: 1, padding: '6px 8px', borderRadius: '4px', background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            設為啟用
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setEditingLayoutKey(lKey);
                            setIsSeatEditorOpen(true);
                          }}
                          style={{ flex: 1, padding: '6px 8px', borderRadius: '4px', background: 'var(--accent-primary)', color: '#ffffff', border: 'none', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                        >
                          <Edit2 size={13} /> 編輯劃位
                        </button>

                        <button
                          onClick={() => handleDeleteLayout(lKey, layout.name)}
                          style={{ padding: '6px 10px', borderRadius: '4px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', fontSize: '0.75rem', cursor: 'pointer' }}
                          title="刪除佈局"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid var(--glass-border)', padding: '40px', textAlign: 'center', color: '#64748b' }}>
            請由左側點選班級以檢視詳細資料
          </div>
        )}
      </div>

      {/* 彈窗 1：新增班級對話框 */}
      {isAddClassModalOpen && (
        <div
          onClick={() => setIsAddClassModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '16px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '440px', background: '#ffffff', borderRadius: '12px', border: '1px solid var(--glass-border)', padding: '24px', boxSizing: 'border-box' }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              ➕ 新增班級
            </h3>

            <form onSubmit={handleCreateClass} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  班級帳號代碼 (僅限英文、數字與底線，如 101, cs_3a)
                </label>
                <input
                  type="text"
                  required
                  pattern="^[a-zA-Z0-9_-]+$"
                  value={newAccount}
                  onChange={(e) => setNewAccount(e.target.value)}
                  placeholder="例如: 101"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  班級中文名稱
                </label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="例如: 一年甲班"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  學生總人數
                </label>
                <input
                  type="number"
                  min="0"
                  max="300"
                  required
                  value={newStudentCount}
                  onChange={(e) => setNewStudentCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  班級登入密碼
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="請設定登入密碼"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddClassModalOpen(false)}
                  style={{ flex: 1, padding: '9px', borderRadius: '6px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', fontWeight: 600, cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '9px', borderRadius: '6px', background: 'var(--accent-primary)', color: '#ffffff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                >
                  確定建立
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 彈窗 2：新增座位佈局對話框 */}
      {isAddLayoutOpen && (
        <div
          onClick={() => setIsAddLayoutOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '16px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '400px', background: '#ffffff', borderRadius: '12px', border: '1px solid var(--glass-border)', padding: '24px', boxSizing: 'border-box' }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
              ➕ 新增座位佈局
            </h3>

            <form onSubmit={handleAddLayout} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  佈局名稱 (如: 期中考梅花座)
                </label>
                <input
                  type="text"
                  required
                  value={newLayoutName}
                  onChange={(e) => setNewLayoutName(e.target.value)}
                  placeholder="例如: 考試座位"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    排數 (Rows)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={newLayoutRows}
                    onChange={(e) => setNewLayoutRows(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    每排席數 (Cols)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={newLayoutCols}
                    onChange={(e) => setNewLayoutCols(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddLayoutOpen(false)}
                  style={{ flex: 1, padding: '9px', borderRadius: '6px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', fontWeight: 600, cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '9px', borderRadius: '6px', background: 'var(--accent-primary)', color: '#ffffff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
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
