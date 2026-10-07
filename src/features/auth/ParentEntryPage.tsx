import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useParentStore } from '@/store/useParentStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShieldCheck, Search, ArrowRight, UserCheck } from 'lucide-react'
import type { VerifyStudentParentAccessResult } from '@/lib/database.types'

export const ParentEntryPage: React.FC = () => {
  const navigate = useNavigate()
  const { setParentAuth } = useParentStore()

  const [studentNo, setStudentNo] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    const cleanNo = studentNo.trim()
    const cleanCode = verifyCode.trim()

    if (!cleanNo || !cleanCode) {
      setErrorMessage('請完整填寫學生學號與安全驗證碼')
      setIsSubmitting(false)
      return
    }

    try {
      // 呼叫 SECURITY DEFINER 加固 RPC verify_student_parent_access
      const { data, error } = await supabase.rpc('verify_student_parent_access', {
        p_student_no: cleanNo,
        p_verify_code: cleanCode,
      })

      if (error) {
        console.warn('[ParentEntry] RPC execution warning:', error.message)
        // Zero-Leak 原則：統一回報無效憑證，防止列舉攻擊
        setErrorMessage('學號或安全防護碼不相符，請核對後重新輸入')
        return
      }

      const rows = data as VerifyStudentParentAccessResult[] | null

      if (rows && rows.length > 0) {
        const row = rows[0]
        setParentAuth({
          id: row.student_id,
          name: row.student_name,
          studentNo: row.student_no,
          seatNumber: row.seat_number,
          className: row.class_name,
          schoolName: row.school_name,
        })
        navigate('/History')
        return
      }

      // Zero-Leak 原則：查無此人或碼不相符，統一回傳查無結果
      setErrorMessage('學號或安全防護碼不相符，請核對後重新輸入')
    } catch (err) {
      console.warn('[ParentEntry] Verification exception:', err)
      setErrorMessage('連線驗證異常，請稍後再試')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">家長免登入考勤查閱</h2>
        <p className="text-xs text-muted-foreground">
          基於 Zero-Leak 雙因子防護機制，僅憑學號與專屬驗證碼即可安全查閱出缺席
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            {errorMessage}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">學生學號 (Student ID)</label>
          <Input
            type="text"
            value={studentNo}
            onChange={(e) => setStudentNo(e.target.value)}
            placeholder="例如: 112012"
            required
            autoComplete="off"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">安全驗證碼 (生日 4 碼或座號)</label>
          <Input
            type="password"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            placeholder="例如: 12 或 0521"
            required
            autoComplete="off"
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          <Search className="mr-2 h-4 w-4" />
          {isSubmitting ? '驗證核對中...' : '驗證並查閱考勤'}
        </Button>
      </form>

      <div className="border-t border-border pt-4 text-center">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <UserCheck className="h-3.5 w-3.5" />
          教職員與行政管理人員入口
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
