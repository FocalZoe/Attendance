import React from 'react'
import { Outlet } from 'react-router-dom'
import { TopNav } from './TopNav'

export const AppLayout: React.FC = () => {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <TopNav />

      {/* 主應用區域 */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-background">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
