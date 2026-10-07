import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

export const AuthLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen w-full flex-col justify-center bg-muted/40 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-md flex-col justify-center space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-none">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Zoe 智慧考勤系統</h1>
          <p className="text-sm text-muted-foreground">
            多租戶與邊緣視覺辨識架構
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 text-card-foreground">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
