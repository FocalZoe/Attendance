import * as React from 'react';
import { supabase, createIsolatedClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PasswordInput } from '@/components/ui/password-input';
import { InlineAlert } from '@/components/ui/inline-alert';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { validatePassword } from '@/lib/password';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { UserCheck, UserPlus, UserX } from 'lucide-react';
import { friendlyError } from '@/lib/errors';

export interface SchoolAdminInfo {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active?: boolean;
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

  const { request: requestConfirm, dialog: confirmDialog } = useConfirm();

  const setActive = async (adminId: string, active: boolean) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { error: rpcError } = await supabase.rpc('set_user_active', {
        p_profile_id: adminId,
        p_active: active,
      });

      if (rpcError) {
        setErrorMsg(friendlyError(rpcError, active ? '啟用失敗。請稍後再試。' : '停用失敗。請稍後再試。').message);
        return;
      }

      onRefresh?.();
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err, '帳號狀態變更失敗。請稍後再試。').message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = (adminId: string, adminName: string) => {
    requestConfirm({
      title: `停用「${adminName}」的帳號？`,
      description: '停用後這位主管無法登入。歷史點名紀錄會保留，之後可以重新啟用。',
      confirmLabel: '停用帳號',
      destructive: true,
      action: () => setActive(adminId, false),
    });
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string)?.trim();
    const email = (formData.get('email') as string)?.trim().toLowerCase();
    const password = formData.get('password') as string;
    const phone = (formData.get('phone') as string)?.trim() || null;

    if (!name || !email || !password) {
      setErrorMsg('請填寫主管姓名、信箱與初始密碼。');
      setLoading(false);
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setErrorMsg(passwordError);
      setLoading(false);
      return;
    }

    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingProfile) {
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
            setErrorMsg(friendlyError(updateError, '更新主管資料失敗。請稍後再試。').message);
            setLoading(false);
            return;
          }
        }
      } else {
        const isolated = createIsolatedClient();
        const { error: signUpError } = await isolated.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              phone,
            },
          },
        });

        if (signUpError) {
          setErrorMsg(friendlyError(signUpError, '建立主管帳號失敗。請稍後再試。').message);
          setLoading(false);
          return;
        }

        // 新帳號預設為未綁定學校的 teacher，由系統總管以 RPC 提升為該校主管
        const { error: assignError } = await supabase.rpc('assign_school_admin', {
          p_school_id: school.id,
          p_email: email,
          p_name: name,
          p_phone: phone,
        });
        if (assignError) {
          setErrorMsg(friendlyError(assignError, '指派主管失敗。請稍後再試。').message);
          setLoading(false);
          return;
        }
      }

      setShowAddForm(false);
      onRefresh?.();
    } catch (err: unknown) {
      setErrorMsg(friendlyError(err, '指派主管失敗。請稍後再試。').message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        管理主管（{admins.length}）
      </Button>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setShowAddForm(false);
            setErrorMsg('');
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{school.name}</DialogTitle>
            <DialogDescription>
              學校代碼 <span className="tabular font-medium text-foreground">{school.code}</span>
            </DialogDescription>
          </DialogHeader>

          {errorMsg && <InlineAlert>{errorMsg}</InlineAlert>}

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-base font-bold text-foreground">
                學校主管（{admins.length}）
              </h3>
              {!showAddForm && (
                <Button size="sm" onClick={() => setShowAddForm(true)}>
                  <UserPlus aria-hidden="true" />
                  新增主管
                </Button>
              )}
            </div>

            {admins.length === 0 ? (
              <EmptyState
                title="這所學校還沒有主管"
                description="新增一位主管，或把學校代碼交給主管，讓他自己到「開通學校」頁註冊。"
              />
            ) : (
              <ScrollArea className="rounded-md border border-border" viewportClassName="max-h-64">
                <ul className="divide-y divide-border">
                  {admins.map((admin) => (
                    <li key={admin.id} className="flex items-center justify-between gap-3 px-3 py-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-medium text-foreground">
                          <span className="truncate">{admin.name}</span>
                          {admin.is_active === false && <Badge variant="destructive">已停用</Badge>}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">{admin.email}</p>
                        {admin.phone && (
                          <p className="tabular truncate text-sm text-muted-foreground">{admin.phone}</p>
                        )}
                      </div>

                      {admin.is_active === false ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActive(admin.id, true)}
                          disabled={loading}
                        >
                          <UserCheck aria-hidden="true" />
                          啟用
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeactivate(admin.id, admin.name)}
                          disabled={loading}
                        >
                          <UserX aria-hidden="true" />
                          停用
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </section>

          {showAddForm && (
            <form onSubmit={handleAdd} className="space-y-4 border-t border-border pt-4">
              <h3 className="font-display text-base font-bold text-foreground">新增主管</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="admin-name">姓名</Label>
                  <Input id="admin-name" name="name" required autoFocus placeholder="例如：林主任" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-email">登入信箱</Label>
                  <Input
                    id="admin-email"
                    name="email"
                    type="email"
                    required
                    placeholder="admin@school.edu.tw"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-pass">初始密碼</Label>
                  <PasswordInput
                    id="admin-pass"
                    name="password"
                    autoComplete="new-password"
                    required
                    placeholder="至少 6 個字元"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-phone">聯絡電話（選填）</Label>
                  <Input id="admin-phone" name="phone" type="tel" placeholder="0912-345-678" />
                </div>
              </div>
              <Button type="submit" disabled={loading}>
                {loading && <Spinner />}
                新增主管
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  );
}
