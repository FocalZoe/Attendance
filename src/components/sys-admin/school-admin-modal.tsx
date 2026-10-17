'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { removeSchoolAdminAction, assignSchoolAdminAction } from '@/app/actions/schools';
import { Users, UserX, UserPlus, X, Shield, Phone, Mail, Calendar, AlertCircle } from 'lucide-react';

interface SchoolAdminInfo {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
}

interface SchoolAdminModalProps {
  school: {
    id: string;
    name: string;
    code: string;
  };
  admins: SchoolAdminInfo[];
}

export function SchoolAdminModal({ school, admins }: SchoolAdminModalProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');

  const handleRemove = async (adminId: string, adminName: string) => {
    if (!confirm(`確定要解除「${adminName}」的學校主管職務嗎？`)) {
      return;
    }

    setLoading(true);
    setErrorMsg('');
    const res = await removeSchoolAdminAction(adminId);
    if (!res.success) {
      setErrorMsg(res.error || '解任失敗');
    }
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const formData = new FormData(e.currentTarget);
    formData.append('school_id', school.id);

    const res = await assignSchoolAdminAction(formData);
    if (!res.success) {
      setErrorMsg(res.error || '指派主管失敗');
    } else {
      setShowAddForm(false);
    }
    setLoading(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="text-xs h-8 px-2.5"
      >
        <Users className="w-3.5 h-3.5 mr-1 text-slate-600" />
        管理主管 ({admins.length})
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-lg border border-slate-300 w-full max-w-xl overflow-hidden shadow-xl animate-in fade-in-0 zoom-in-95">
            {/* 彈窗標題列 */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{school.name}</h3>
                  <p className="text-xs text-slate-500">
                    學校代碼：
                    <span className="font-mono bg-slate-200 px-1 py-0.5 rounded text-slate-800">
                      {school.code}
                    </span>
                    {' '}· 所屬管理主管團隊
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowAddForm(false);
                  setErrorMsg('');
                }}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 彈窗主要內容 */}
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-center space-x-2 text-rose-700 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 現有主管名冊 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    現有學校主管名冊 ({admins.length})
                  </span>
                  {!showAddForm && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowAddForm(true)}
                      className="text-xs h-7 px-2"
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-1" />
                      指派新主管
                    </Button>
                  )}
                </div>

                {admins.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-md bg-slate-50">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                    <p className="text-xs font-medium text-slate-500">該校尚未綁定任何主管</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      主管可於註冊頁輸入代碼「{school.code}」自主加入，或由總管手動新增
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {admins.map((admin) => (
                      <div
                        key={admin.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-slate-900">{admin.name}</span>
                            <Badge variant="success" className="text-[10px] py-0 px-1.5">
                              學校主管
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center">
                              <Mail className="w-3 h-3 mr-1 text-slate-400" />
                              {admin.email}
                            </span>
                            {admin.phone && (
                              <span className="flex items-center">
                                <Phone className="w-3 h-3 mr-1 text-slate-400" />
                                {admin.phone}
                              </span>
                            )}
                            <span className="flex items-center text-[11px] text-slate-400">
                              <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                              {new Date(admin.created_at).toLocaleDateString('zh-TW')}
                            </span>
                          </div>
                        </div>

                        <Button
                          variant="danger"
                          size="sm"
                          disabled={loading}
                          onClick={() => handleRemove(admin.id, admin.name)}
                          className="text-xs h-7 px-2 shrink-0 ml-2"
                          title="解除該員之學校主管職務"
                        >
                          <UserX className="w-3 h-3 mr-1" />
                          解除
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 新增指派表單 */}
              {showAddForm && (
                <div className="pt-3 border-t border-slate-200 bg-slate-50/70 p-3 rounded-lg border border-slate-300">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center">
                      <UserPlus className="w-3.5 h-3.5 mr-1 text-blue-600" />
                      指派新主管至「{school.name}」
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      取消
                    </button>
                  </div>

                  <form onSubmit={handleAdd} className="space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        label="主管姓名"
                        name="name"
                        required
                        placeholder="例如：張主任"
                        className="text-xs h-8"
                      />
                      <Input
                        label="公務電話"
                        name="phone"
                        placeholder="例如：02-12345678"
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        label="公務信箱 (Email)"
                        name="email"
                        type="email"
                        required
                        placeholder="admin@school.edu.tw"
                        className="text-xs h-8"
                      />
                      <Input
                        label="預設密碼"
                        name="password"
                        type="password"
                        required
                        placeholder="至少 6 位數"
                        className="text-xs h-8"
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={loading}
                      className="w-full mt-1 text-xs"
                    >
                      {loading ? '處理中...' : '確認指派為該校主管'}
                    </Button>
                  </form>
                </div>
              )}
            </div>

            {/* 彈窗底部 */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsOpen(false);
                  setShowAddForm(false);
                }}
              >
                關閉
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
