import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore, type UserRole } from '@/store/useAuthStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LogIn, KeyRound, ShieldAlert } from 'lucide-react'

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg('')

    try {
      // 透過 Supabase Auth 進行真實身分認證
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error || !data?.user) {
        setErrorMsg('帳號或密碼錯誤，請確認後重新輸入')
        return
      }

      // 查詢關聯之使用者 Profile 與所屬學校
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*, schools(*)')
        .eq('id', data.user.id)
        .single()

      if (profileError || !profile) {
        setErrorMsg('此帳號尚未綁定學校機構身分，請洽全校管理員')
        return
      }

      const assignedRole = profile.role as UserRole

      // 若為教師，查詢指派之班級列表
      let assignedClassIds: string[] = []
      let homeroomClassIds: string[] = []
      if (assignedRole === 'teacher') {
        const { data: tcData } = await supabase
          .from('teacher_classes')
          .select('class_id, is_homeroom')
          .eq('teacher_id', data.user.id)

        if (tcData) {
          assignedClassIds = tcData.map((item: { class_id: string }) => item.class_id)
          homeroomClassIds = tcData
            .filter((item: { is_homeroom: boolean }) => item.is_homeroom)
            .map((item: { class_id: string }) => item.class_id)
        }
      }

      setAuth({
        id: data.user.id,
        name: profile.name || data.user.email || '教職員使用者',
        email: data.user.email,
        role: assignedRole,
        schoolId: profile.school_id,
        schoolName: profile.schools?.name || '',
        assignedClassIds: assignedClassIds.length > 0 ? assignedClassIds : undefined,
        homeroomClassIds: homeroomClassIds.length > 0 ? homeroomClassIds : undefined,
      })

      // 導向各身分首頁
      if (assignedRole === 'school_admin') {
        navigate('/Management')
      } else {
        navigate('/Dashboard')
      }
    } catch (err) {
      console.warn('[LoginPage] Login error:', err)
      setErrorMsg('登入驗證過程發生網路異常，請稍後再試')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-semibold tracking-tight">教育人員登入</h2>
        <p className="text-xs text-muted-foreground">
          請輸入學校公務信箱與密碼以進入授權工作台
        </p>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">公務信箱</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@school.edu.tw"
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">密碼</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          <LogIn className="mr-2 h-4 w-4" />
          {isLoading ? '驗證認證中...' : '登入系統'}
        </Button>
      </form>

      <div className="flex flex-col gap-2 pt-2 text-center text-xs text-muted-foreground">
        <Link to="/RegisterSchoolPage" className="hover:text-foreground hover:underline">
          尚未入駐學校？申請註冊開通
        </Link>
        <Link to="/" className="flex items-center justify-center gap-1 text-primary hover:underline">
          <KeyRound className="h-3.5 w-3.5" />
          家長雙因子免登查閱入口
        </Link>
      </div>
    </div>
  )
}
