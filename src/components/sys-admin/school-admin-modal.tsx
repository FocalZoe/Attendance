import * as React from 'react';
import { supabase, createIsolatedClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, UserX, UserPlus, X, Shield, Phone, Mail, Calendar, AlertCircle } from 'lucide-react';

export interface SchoolAdminInfo {
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
  onRefresh?: () => void;
}

export function SchoolAdminModal({ school, admins, onRefresh }: SchoolAdminModalProps) {
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
    try {
      // 優先呼叫安全 RPC
      const { error: rpcError } = await supabase.rpc('remove_school_admin', {
        p_profile_id: adminId,
      });

      if (rpcError) {
        // Fallback 直接更新 profiles
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ school_id: null, role: 'teacher' })
          .eq('id', adminId);

        if (updateError) {
          setErrorMsg(updateError.message || '解任失敗');
          setLoading(false);
          return;
        }
      }

      onRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '解任操作失敗';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string)?.trim();
    const email = (formData.get('email') as string)?.trim().toLowerCase();
    const password = (formData.get('password') as string)?.trim();
    const phone = (formData.get('phone') as string)?.trim() || null;

    if (!name || !email || !password) {
      setErrorMsg('請填寫完整的主管姓名、信箱與預設密碼');
      setLoading(false);
      return;
    }

    try {
      // 1. 檢查該信箱是否已在 profiles 註冊
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingProfile) {
        // 已有帳號，呼叫 assign_school_admin RPC 或直接更新
        const { error: rpcError } = await supabase.rpc('assign_school_admin', {
          p_school_id: school.id,
          p_email: email,
          p_name: name,
          p_phone: phone,
        });

        if (rpcError) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ school_id: school.id, role: 'school_admin', name, phone })
            .eq('id', existingProfile.id);

          if (updateError) {
            setErrorMsg(updateError.message);
            setLoading(false);
            return;
          }
        }
      } else {
        // 全新帳號：透過隔離客戶端建立 Auth 使用者，避免覆蓋總管會話
        const isolated = createIsolatedClient();
        const { error: signUpError } = await isolated.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              role: 'school_admin',
              school_id: school.id,
              phone,
            },
          },
        });

        if (signUpError) {
          setErrorMsg(signUpError.message || '建立主管帳號失敗');
          setLoading(false);
          return;
        }
      }

      setShowAddForm(false);
      onRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '指派主管失敗';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
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
          <div className="bg-white rounded-lg border border-slate-300 w-full max-w-xl overflow-hidden shadow-xl">
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
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 內容區塊 */}
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-2 text-rose-700 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 現有主管列表 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    現任學校主管名冊 ({admins.length})
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
                  <div className="p-6 text-center border border-dashed border-slate-300 rounded-lg text-slate-500 text-xs">
                    目前該校尚未配置主管。可點擊上方按鈕指派，或提供代碼讓主管自註冊開通。
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-md bg-white">
                    {admins.map((admin) => (
                      <div
                        key={admin.id}
                        className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-slate-900">{admin.name}</span>
                            <Badge variant="success" className="text-[10px] py-0">主管職</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span className="inline-flex items-center">
                              <Mail className="w-3 h-3 mr-1 text-slate-400" />
                              {admin.email}
                            </span>
                            {admin.phone && (
                              <span className="inline-flex items-center">
                                <Phone className="w-3 h-3 mr-1 text-slate-400" />
                                {admin.phone}
                              </span>
                            )}
                            <span className="inline-flex items-center">
                              <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                              {new Date(admin.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(admin.id, admin.name)}
                          disabled={loading}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 px-2"
                          title="解除主管職務"
                        >
                          <UserX className="w-4 h-4 mr-1" />
                          <span className="text-xs">解任</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 新增主管表單折疊區 */}
              {showAddForm && (
                <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 flex items-center">
                      <UserPlus className="w-3.5 h-3.5 mr-1 text-blue-600" />
                      指派新管理主管至 {school.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      取消
                    </button>
                  </div>

                  <form onSubmit={handleAdd} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <Input
                        label="主管真實姓名"
                        name="name"
                        required
                        placeholder="例如：林教務長"
                        className="bg-white text-xs"
                      />
                      <Input
                        label="公務電子信箱"
                        name="email"
                        type="email"
                        required
                        placeholder="admin@school.edu.tw"
                        className="bg-white text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <Input
                        label="初始登入密碼"
                        name="password"
                        type="password"
                        required
                        placeholder="至少 6 碼"
                        className="bg-white text-xs"
                      />
                      <Input
                        label="聯絡分機 / 手機 (選填)"
                        name="phone"
                        placeholder="0912-345-678"
                        className="bg-white text-xs"
                      />
                    </div>

                    <div className="flex justify-end space-x-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddForm(false)}
                        className="text-xs"
                      >
                        取消
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={loading}
                        className="text-xs"
                      >
                        {loading ? '建立中...' : '確認指派主管'}
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* 彈窗底欄 */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsOpen(false);
                  setShowAddForm(false);
                  setErrorMsg('');
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
