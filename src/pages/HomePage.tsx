import * as React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { Navbar } from '@/components/ui/navbar';
import { Button } from '@/components/ui/button';
import { StatusLegend, StatusMark } from '@/components/ui/status-mark';
import type { AttendanceStatus } from '@/types/database';

/* 首屏主視覺：一張出席簿。null 代表空位。示意用，不是真實資料。 */
const SAMPLE_ROLL: Array<AttendanceStatus | null> = [
  'present', 'present', 'present', null, 'present', 'present',
  'present', 'late', 'present', 'present', 'present', null,
  'present', 'present', 'absent', 'present', 'leave', 'present',
  null, 'present', 'present', 'present', 'present', 'present',
];

const STEPS = [
  {
    title: '在畫面上標出座位',
    body: '用教室鏡頭的畫面，把每個座位拉成一個框並指定給學生。座位以比例儲存，換螢幕也對得上。',
  },
  {
    title: '開鏡頭，系統判斷誰在座位上',
    body: '人物辨識在老師的瀏覽器裡完成，畫面不會上傳做辨識。座位上有人，就標為出席。',
  },
  {
    title: '確認後存檔',
    body: '老師可逐人改成遲到、請假或缺席，再按下完成。系統會保留當下的全景照片作為紀錄。',
  },
];

const ROLES = [
  ['系統總管', '開通學校、指派學校主管、查看各校概況。'],
  ['學校主管', '管理班級、教師帳號、學生名冊，查看全校出勤。'],
  ['任課教師', '設定座位與課表、進行點名、更正出勤。'],
  ['學生家長', '不需註冊，用學號和電話末四碼查看孩子的出勤。'],
] as const;

export function HomePage() {
  const { profile } = useAuthStore();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar profile={profile} />

      <main className="flex-1">
        {/* 首屏 */}
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:px-8 lg:py-20">
            <div>
              <h1 className="text-4xl font-bold leading-tight text-foreground sm:text-5xl">
                對著教室拍一下，
                <br />
                點名就完成。
              </h1>
              <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
                老師在鏡頭畫面上標好座位，系統判斷每個座位有沒有人。確認後存檔，出勤紀錄與當下照片都會保留，家長也能自己查詢。
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {profile ? (
                  <Button asChild size="lg">
                    <Link to="/dashboard">進入我的控制台</Link>
                  </Button>
                ) : (
                  <Button asChild size="lg">
                    <Link to="/login">教職員登入</Link>
                  </Button>
                )}
                <Button asChild size="lg" variant="outline">
                  <Link to="/parent-query">家長查勤</Link>
                </Button>
              </div>

              {!profile && (
                <p className="mt-4 text-sm text-muted-foreground">
                  學校還沒有帳號？{' '}
                  <Link to="/register" className="font-medium text-primary underline underline-offset-4">
                    開通學校
                  </Link>
                </p>
              )}
            </div>

            {/* 出席簿 */}
            <figure className="rounded-lg border border-border bg-card p-4 sm:p-6" aria-label="座位出席示意圖">
              <div className="grid grid-cols-6 gap-2 sm:gap-3" aria-hidden="true">
                {SAMPLE_ROLL.map((status, i) =>
                  status ? (
                    <StatusMark key={i} status={status} size="lg" className="justify-center" />
                  ) : (
                    <span
                      key={i}
                      className="h-11 w-11 justify-self-center rounded-sm border-[1.5px] border-dashed border-input"
                    />
                  )
                )}
              </div>
              <figcaption className="mt-5 border-t border-border pt-4">
                <StatusLegend />
                <p className="mt-3 text-xs text-muted-foreground">示意圖：虛線格是沒有人的座位。</p>
              </figcaption>
            </figure>
          </div>
        </section>

        {/* 流程：這裡的內容確實有先後順序 */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">一次點名，三個動作</h2>
          <ol className="mt-8 grid gap-0 divide-y divide-border border-y border-border md:grid-cols-3 md:divide-x md:divide-y-0">
            {STEPS.map((step, index) => (
              <li key={step.title} className="py-6 md:px-6 md:first:pl-0 md:last:pr-0">
                <p className="text-sm font-medium text-primary">第 {index + 1} 步</p>
                <h3 className="mt-1 text-lg font-bold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 角色 */}
        <section className="border-t border-border">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
            <div>
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">各校資料彼此隔離</h2>
              <p className="mt-3 max-w-md text-sm text-muted-foreground">
                每所學校只能看到自己的班級與學生。不同身分看到的功能也不同。
              </p>
            </div>
            <dl className="divide-y divide-border border-y border-border">
              {ROLES.map(([role, desc]) => (
                <div key={role} className="grid gap-1 py-4 sm:grid-cols-[8rem_1fr] sm:gap-6">
                  <dt className="font-bold text-foreground">{role}</dt>
                  <dd className="text-sm text-muted-foreground">{desc}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} 班級自動化點名系統</p>
          <nav className="flex gap-5" aria-label="頁尾連結">
            <Link to="/parent-query" className="hover:text-foreground">家長查勤</Link>
            <Link to="/login" className="hover:text-foreground">教職員登入</Link>
            <Link to="/register" className="hover:text-foreground">開通學校</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
