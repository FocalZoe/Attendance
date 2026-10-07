import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { School, ArrowLeft, AlertCircle, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export const RegisterSchoolPage: React.FC = () => {
  const navigate = useNavigate()
  const [schoolName, setSchoolName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleDemoFill = () => {
    const randomNum = Math.floor(Math.random() * 900) + 100
    setSchoolName('國立專題示範中學')
    setSchoolCode('999999')
    setAdminEmail(`admin${randomNum}@ck.tp.edu.tw`)
    setAdminPassword('Demo123456!')
    setErrorMessage('')
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    const cleanEmail = adminEmail.trim().toLowerCase()
    const cleanCode = schoolCode.trim()
    const cleanName = schoolName.trim()

    // 領域規範檢核：機關網域白名單 (*.edu.tw)
    if (!cleanEmail.endsWith('.edu.tw')) {
      setErrorMessage('ERR_UNVERIFIED_SCHOOL_DOMAIN: 開通學校強制限定使用教育部教育網域信箱 (*.edu.tw)')
      return
    }

    // 領域規範檢核：教育部 6 碼代碼
    if (cleanCode.length < 5) {
      setErrorMessage('請填寫完整之教育部學校代碼')
      return
    }
    
    if (adminPassword.length < 6) {
      setErrorMessage('密碼長度至少需 6 個字元')
      return
    }

    setIsSubmitting(true)
    try {
      // 1. 建立 Supabase Auth 帳號
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: adminPassword,
      })

      if (authError || !authData.user) {
        setErrorMessage('建立管理員帳號失敗：' + (authError?.message || '未知錯誤'))
        return
      }

      // 2. 建立學校實體 (Tenant)
      // 由於 RLS SELECT 限制，改由前端產生 UUID 避免呼叫 .select() 時因 Profile 尚未建立而報錯
      const newSchoolId = crypto.randomUUID()
      
      const { error: schoolError } = await supabase.from('schools').insert({
        id: newSchoolId,
        name: cleanName,
        code: cleanCode,
        edu_code: cleanCode,
        contact_email: cleanEmail,
        is_verified: true,
      })

      if (schoolError) {
        setErrorMessage('註冊學校機構失敗：' + schoolError.message)
        return
      }

      // 3. 綁定管理員權限至 user_profiles
      const { error: profileError } = await supabase.from('user_profiles').insert({
        id: authData.user.id,
        school_id: newSchoolId,
        role: 'school_admin',
        name: '系統總管',
        email: cleanEmail
      })

      if (profileError) {
        setErrorMessage('綁定管理員權限失敗：' + profileError.message)
        return
      }

      alert(`學校「${cleanName}」入駐開通成功，請使用剛設定的帳號密碼登入系統。`)
      
      // 自動登出，確保乾淨狀態回到登入頁
      await supabase.auth.signOut()
      navigate('/login')
    } catch (err) {
      console.warn('[RegisterSchool] Registration exception:', err)
      setErrorMessage('提交註冊時發生錯誤，請稍後再試')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-center relative">
        <h2 className="text-xl font-semibold tracking-tight">學校機構開通入駐</h2>
        <p className="text-xs text-muted-foreground">
          依據多租戶架構建立學校識別與專屬資料實體
        </p>
        <div className="pt-2 flex justify-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDemoFill}
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground border-dashed"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            一鍵帶入專題示範資料
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">學校全銜</label>
          <Input
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder="例如：台北市立示範高級中學"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">教育部學校代碼 (6 碼)</label>
          <Input
            value={schoolCode}
            onChange={(e) => setSchoolCode(e.target.value)}
            placeholder="例如：333301"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">總管教育機構信箱 (*.edu.tw)</label>
          <Input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="admin@school.tp.edu.tw"
            required
          />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">管理員密碼</label>
          <Input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="設定登入密碼"
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          <School className="mr-2 h-4 w-4" />
          {isSubmitting ? '建立機構與帳號中...' : '確認提交註冊'}
        </Button>
      </form>

      <div className="pt-2 text-center text-xs">
        <Link to="/login" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          返回登入頁面
        </Link>
      </div>
    </div>
  )
}
